import argparse
import csv
import json
import math
import os
import re
import shutil
import tempfile
from pathlib import Path


REQUIRED_ASSET_FIELDS = (
    'box_id', 'piso', 'top_pct', 'left_pct', 'width_pct', 'height_pct',
    'ip_address', 'mac_address', 'hostname_actual', 'hostname_propuesto',
    'switch_connection', 'status'
)
VALID_STATUSES = {
    'VERIFICADO_ACTIVO', 'SOLO_UNIFI_NO_AD', 'SOLO_AD_INACTIVO', 'AMBIGUO', 'BORRADOR'
}


def normalize(value):
    normalized = str(value or '').strip().casefold()
    return '' if normalized in {'', 'n/d'} else normalized


def csv_value(row, column, default='N/D'):
    value = str(row.get(column) or '').strip()
    return value or default


def parse_csv(filepath, required_columns, any_required=()):
    with open(filepath, mode='r', encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames:
            raise ValueError(f'{filepath}: falta la fila de encabezados.')

        headers = [header.strip() if header else '' for header in reader.fieldnames]
        if any(not header for header in headers) or len(set(headers)) != len(headers):
            raise ValueError(f'{filepath}: hay encabezados vacíos o duplicados.')
        reader.fieldnames = headers
        missing = [column for column in required_columns if column not in headers]
        if missing:
            raise ValueError(f'{filepath}: faltan columnas requeridas: {", ".join(missing)}.')
        if any_required and not any(column in headers for column in any_required):
            raise ValueError(f'{filepath}: falta una de estas columnas: {", ".join(any_required)}.')

        rows = []
        for row_number, row in enumerate(reader, start=2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f'{filepath}: la fila {row_number} tiene un número de columnas inválido.')
            rows.append(row)
        if not rows:
            raise ValueError(f'{filepath}: no contiene filas de datos.')
        return rows


def validate_assets(assets):
    if not isinstance(assets, list):
        raise ValueError('La raíz del JSON debe ser un array.')

    seen_box_ids = set()
    for index, asset in enumerate(assets, start=1):
        if not isinstance(asset, dict) or any(not isinstance(asset.get(field), str) or not asset[field].strip()
                                               for field in REQUIRED_ASSET_FIELDS if field not in {'piso', 'top_pct', 'left_pct', 'width_pct', 'height_pct'}):
            raise ValueError(f'El activo {index} no cumple los campos de texto requeridos.')
        if asset['box_id'] in seen_box_ids:
            raise ValueError(f'box_id duplicado: {asset["box_id"]}.')
        seen_box_ids.add(asset['box_id'])
        if asset['status'] not in VALID_STATUSES:
            raise ValueError(f'Estado no válido en {asset["box_id"]}: {asset["status"]}.')
        if asset['piso'] not in {5, 17}:
            raise ValueError(f'Piso no soportado en {asset["box_id"]}.')

        coordinates = ('top_pct', 'left_pct', 'width_pct', 'height_pct')
        if any(isinstance(asset.get(field), bool) or not isinstance(asset.get(field), (int, float))
               or not math.isfinite(asset[field]) or not 0 <= asset[field] <= 100 for field in coordinates):
            raise ValueError(f'Coordenadas no válidas en {asset["box_id"]}.')
        if asset['width_pct'] == 0 or asset['height_pct'] == 0 \
                or asset['top_pct'] + asset['height_pct'] > 100 \
                or asset['left_pct'] + asset['width_pct'] > 100:
            raise ValueError(f'Geometría fuera del plano en {asset["box_id"]}.')


def create_backup_path(target):
    backup = target.with_name(f'{target.name}.bak')
    suffix = 1
    while backup.exists():
        backup = target.with_name(f'{target.name}.bak.{suffix}')
        suffix += 1
    return backup


def atomic_write_assets(target, assets):
    target = Path(target)
    validate_assets(assets)
    if not target.parent.is_dir():
        raise FileNotFoundError(f'No existe el directorio de salida: {target.parent}')

    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=f'.{target.name}.', suffix='.tmp', dir=target.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(file_descriptor, 'w', encoding='utf-8', newline='') as stream:
            json.dump(assets, stream, indent=2, ensure_ascii=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())

        with temporary.open(encoding='utf-8') as stream:
            validated_content = json.load(stream)
        validate_assets(validated_content)

        if target.exists():
            backup = create_backup_path(target)
            shutil.copy2(target, backup)
        os.replace(temporary, target)
        return backup if target.exists() and 'backup' in locals() else None
    finally:
        temporary.unlink(missing_ok=True)


def find_duplicate_rows(rows, getters):
    rows_by_key = {}
    for row in rows:
        for key in {normalize(getter(row)) for getter in getters} - {''}:
            rows_by_key.setdefault(key, []).append(row)
    duplicate_rows = set()
    duplicate_values = []
    for key, matches in rows_by_key.items():
        if len(matches) > 1:
            duplicate_values.append(key)
            duplicate_rows.update(id(row) for row in matches)
    return duplicate_rows, duplicate_values


def add_index(index, value, row):
    key = normalize(value)
    if key:
        index.setdefault(key, []).append(row)


def indexed_matches(index, keys):
    matches = {}
    for key in keys:
        for row in index.get(normalize(key), []):
            matches[id(row)] = row
    return list(matches.values())


def unique_box_id(candidate, used_box_ids):
    base = candidate or f'ACTIVO-{len(used_box_ids) + 1}'
    result = base
    suffix = 2
    while result in used_box_ids:
        result = f'{base}-{suffix}'
        suffix += 1
    used_box_ids.add(result)
    return result, result != base


def crosscheck_data(unifi_csv, ad_csv, json_actual):
    target = Path(json_actual)
    with target.open(encoding='utf-8') as stream:
        base_assets = json.load(stream)
    validate_assets(base_assets)

    unifi_rows = parse_csv(
        unifi_csv, ('Name', 'IP Address', 'MAC Address', 'Connection')
    )
    ad_rows = parse_csv(
        ad_csv, ('Hostname_Actual',), ('IP_Registrada_AD', 'IP_Resuelta_DNS')
    )

    duplicate_unifi_ips, duplicate_unifi_ip_values = find_duplicate_rows(
        unifi_rows, (lambda row: row.get('IP Address'),)
    )
    duplicate_unifi_names, duplicate_unifi_name_values = find_duplicate_rows(
        unifi_rows, (lambda row: row.get('Name'),)
    )
    duplicate_ad_ips, duplicate_ad_ip_values = find_duplicate_rows(
        ad_rows, (lambda row: row.get('IP_Registrada_AD'), lambda row: row.get('IP_Resuelta_DNS'))
    )
    duplicate_ad_names, duplicate_ad_name_values = find_duplicate_rows(
        ad_rows, (lambda row: row.get('Hostname_Actual'),)
    )

    ad_by_ip = {}
    ad_by_hostname = {}
    for row in ad_rows:
        add_index(ad_by_ip, row.get('IP_Registrada_AD'), row)
        add_index(ad_by_ip, row.get('IP_Resuelta_DNS'), row)
        add_index(ad_by_hostname, row.get('Hostname_Actual'), row)

    base_by_ip = {}
    base_by_name = {}
    for asset in base_assets:
        add_index(base_by_ip, asset.get('ip_address'), asset)
        add_index(base_by_name, asset.get('box_id'), asset)
        add_index(base_by_name, asset.get('hostname_actual'), asset)

    matched_ad = set()
    ambiguous_ad = duplicate_ad_ips | duplicate_ad_names
    used_box_ids = set()
    result = []
    ambiguities = []
    for label, values in (
        ('IP UniFi', duplicate_unifi_ip_values),
        ('hostname UniFi', duplicate_unifi_name_values),
        ('IP Active Directory', duplicate_ad_ip_values),
        ('hostname Active Directory', duplicate_ad_name_values),
    ):
        ambiguities.extend(f'{label} duplicado: {value}' for value in values)

    def build_asset(unifi, ad, status):
        ip = csv_value(unifi, 'IP Address') if unifi else 'N/D'
        if ip == 'N/D' and ad:
            ip = csv_value(ad, 'IP_Registrada_AD')
            if ip == 'N/D':
                ip = csv_value(ad, 'IP_Resuelta_DNS')
        name = csv_value(unifi, 'Name') if unifi else 'N/D'
        hostname = csv_value(ad, 'Hostname_Actual') if ad else name

        baseline_candidates = indexed_matches(base_by_ip, (ip,))
        if not baseline_candidates:
            baseline_candidates = indexed_matches(base_by_name, (name, hostname))
        baseline = baseline_candidates[0] if len(baseline_candidates) == 1 else {}
        if len(baseline_candidates) > 1:
            status = 'AMBIGUO'
            ambiguities.append(f'baseline ambiguo para {ip}')

        box_match = re.search(r'Box\s*(\d+)', name, re.IGNORECASE)
        proposed_box_id = baseline.get('box_id') or (
            f'BOX-{int(box_match.group(1)):02d}' if box_match else name if name != 'N/D'
            else hostname if hostname != 'N/D' else f'AD-{ip}'
        )
        box_id, duplicated_box = unique_box_id(proposed_box_id, used_box_ids)
        if duplicated_box:
            status = 'AMBIGUO'
            ambiguities.append(f'box_id duplicado: {proposed_box_id}')

        floor = baseline.get('piso', 5)
        return {
            **baseline,
            'box_id': box_id,
            'piso': floor,
            'top_pct': baseline.get('top_pct', 50.0),
            'left_pct': baseline.get('left_pct', 50.0),
            'width_pct': baseline.get('width_pct', 3.5),
            'height_pct': baseline.get('height_pct', 4.0),
            'ip_address': ip,
            'mac_address': csv_value(unifi, 'MAC Address') if unifi else baseline.get('mac_address', 'N/D'),
            'hostname_actual': hostname,
            'hostname_propuesto': baseline.get('hostname_propuesto') or hostname,
            'switch_connection': csv_value(unifi, 'Connection') if unifi else baseline.get('switch_connection', 'N/D'),
            'last_seen': csv_value(unifi, 'Last Seen') if unifi else baseline.get('last_seen', 'N/D'),
            'operating_system': csv_value(ad, 'Sistema_Operativo') if ad else baseline.get('operating_system', 'N/D'),
            'status': status,
        }

    for row in unifi_rows:
        ip = csv_value(row, 'IP Address')
        name = csv_value(row, 'Name')
        candidates = indexed_matches(ad_by_ip, (ip,)) + indexed_matches(ad_by_hostname, (name,))
        candidates_by_id = {id(candidate): candidate for candidate in candidates}
        candidates = list(candidates_by_id.values())
        ambiguous = (
            id(row) in duplicate_unifi_ips
            or id(row) in duplicate_unifi_names
            or len(candidates) > 1
            or any(id(candidate) in ambiguous_ad for candidate in candidates)
        )
        ad = candidates[0] if len(candidates) == 1 and not ambiguous else None
        if ambiguous:
            ambiguous_ad.update(id(candidate) for candidate in candidates)
        if ad:
            matched_ad.add(id(ad))
        result.append(build_asset(row, ad, 'AMBIGUO' if ambiguous else 'VERIFICADO_ACTIVO' if ad else 'SOLO_UNIFI_NO_AD'))

    for row in ad_rows:
        if id(row) in matched_ad:
            continue
        status = 'AMBIGUO' if id(row) in ambiguous_ad else 'SOLO_AD_INACTIVO'
        result.append(build_asset(None, row, status))

    validate_assets(result)
    backup = atomic_write_assets(target, result)
    backup_message = f' Respaldo: {backup}' if backup else ' No existía archivo previo para respaldar.'
    print(f'Crosscheck completado: {len(result)} registros en {target}.{backup_message}')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Cruza exportaciones CSV de UniFi y Active Directory.')
    parser.add_argument('--unifi', default='data/unifi_export.csv')
    parser.add_argument('--ad', default='data/ad_export.csv')
    parser.add_argument('--output', default='data/activos_mapeados.json')
    args = parser.parse_args()
    crosscheck_data(args.unifi, args.ad, args.output)