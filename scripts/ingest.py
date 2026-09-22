import csv
import json
import re

def parse_csv(filepath):
    with open(filepath, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        return list(reader)

def crosscheck_data(unifi_csv, ad_csv, json_actual):
    # 1. Cargar referencias existentes para preservar coordenadas (top_pct, left_pct, etc.)
    with open(json_actual, 'r', encoding='utf-8') as f:
        activos_base = json.load(f)
    
    # Crear diccionario indexado por IP
    coordenadas_map = {item['ip_address']: item for item in activos_base if 'ip_address' in item}

    unifi_list = parse_csv(unifi_csv)
    ad_list = parse_csv(ad_csv)

    # Indexar Active Directory por IP
    ad_by_ip = {}
    for row in ad_list:
        ip_ad = row.get('IP_Registrada_AD', '').strip()
        if ip_ad:
            ad_by_ip[ip_ad] = row

    resultado_merge = []

    # 2. Procesar UniFi como fuente de red activa
    for row in unifi_list:
        ip = row.get('IP Address', '').strip()
        name_unifi = row.get('Name', '').strip()
        mac = row.get('MAC Address', '').strip()
        connection = row.get('Connection', '').strip()
        last_seen = row.get('Last Seen', 'N/D').strip()

        # Extraer Box de la columna Name de UniFi si existe (ej: "Box 31" -> "BOX-31")
        match_box = re.search(r'Box\s*(\d+)', name_unifi, re.IGNORECASE)
        box_id = f"BOX-{int(match_box.group(1)):02d}" if match_box else name_unifi

        # Buscar cruce en AD
        ad_match = ad_by_ip.get(ip)

        if ad_match:
            hostname_ad = ad_match.get('Hostname_Actual', name_unifi)
            status = "VERIFICADO_ACTIVO"
        else:
            hostname_ad = name_unifi
            status = "SOLO_UNIFI_NO_AD"

        # Recuperar coordenadas de la base existente o poner valores por defecto
        base_item = coordenadas_map.get(ip, {})
        
        resultado_merge.append({
            "box_id": box_id,
            "piso": base_item.get("piso", 5),
            "top_pct": base_item.get("top_pct", 50.0),
            "left_pct": base_item.get("left_pct", 50.0),
            "width_pct": base_item.get("width_pct", 3.5),
            "height_pct": base_item.get("height_pct", 4.0),
            "ip_address": ip,
            "mac_address": mac,
            "hostname_actual": hostname_ad,
            "hostname_nuevo": f"P05-{box_id.replace('-', '')}",
            "switch_connection": connection,
            "last_seen": last_seen,
            "status": status
        })

    # 3. Guardar el JSON actualizado
    with open(json_actual, 'w', encoding='utf-8') as f:
        json.dump(resultado_merge, f, indent=2, ensure_ascii=False)

    print(f"✅ Crosscheck completado: {len(resultado_merge)} registros unificados en {json_actual}")

if __name__ == "__main__":
    crosscheck_data('data/unifi_export.csv', 'data/ad_export.csv', 'data/activos_mapeados.json')