import csv
import json
import os

qc_psgc = "1381300000"

# Age bands data for QC (2020 Census)
qc_bands = [
  {"age":"0 - 4","both":291124,"male":149971,"female":141153},
  {"age":"5 - 9","both":276416,"male":143125,"female":133291},
  {"age":"10 - 14","both":258418,"male":134154,"female":124264},
  {"age":"15 - 19","both":241493,"male":122294,"female":119199},
  {"age":"20 - 24","both":274038,"male":137129,"female":136909},
  {"age":"25 - 29","both":276410,"male":139223,"female":137187},
  {"age":"30 - 34","both":252021,"male":128187,"female":123834},
  {"age":"35 - 39","both":219307,"male":110066,"female":109241},
  {"age":"40 - 44","both":195077,"male":96425,"female":98652},
  {"age":"45 - 49","both":165706,"male":81173,"female":84533},
  {"age":"50 - 54","both":146235,"male":69846,"female":76389},
  {"age":"55 - 59","both":119573,"male":55691,"female":63882},
  {"age":"60 - 64","both":94313,"male":42767,"female":51546},
  {"age":"65 - 69","both":61459,"male":26714,"female":34745},
  {"age":"70 - 74","both":37828,"male":15372,"female":22456},
  {"age":"75 - 79","both":19784,"male":7138,"female":12646},
  {"age":"80 years and over","both":21291,"male":6205,"female":15086}
]

qc_bands_json = json.dumps(qc_bands)
pop_male_2020 = 1465480
pop_female_2020 = 1485013

# 1. Update household_agesex_2020.csv
csv_path_agesex = "/Users/vince/personal-projects/mapa/mapa/frontend/data-sets/data/clean/household_agesex_2020.csv"

rows = []
header = []
with open(csv_path_agesex, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    for r in reader:
        if r[0] == qc_psgc:
            continue # Skip if already exists, we will re-add
        rows.append(r)

# Add QC row
rows.append([qc_psgc, "municipality", str(pop_male_2020), str(pop_female_2020), qc_bands_json])

with open(csv_path_agesex, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(rows)

print("Updated household_agesex_2020.csv")

# 2. Update division_stats.csv
csv_path_stats = "/Users/vince/personal-projects/mapa/mapa/frontend/data-sets/backup/division_stats.csv"

rows_stats = []
header_stats = []
updated = False
with open(csv_path_stats, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header_stats = next(reader)
    
    for r in reader:
        if r[0] == qc_psgc:
            # Header indices for pop_male_2020, pop_female_2020, age_sex_2020:
            # Let's dynamically find indices to be safe
            male_idx = header_stats.index("pop_male_2020")
            female_idx = header_stats.index("pop_female_2020")
            agesex_idx = header_stats.index("age_sex_2020")
            
            r[male_idx] = str(pop_male_2020)
            r[female_idx] = str(pop_female_2020)
            r[agesex_idx] = qc_bands_json
            updated = True
        rows_stats.append(r)

if not updated:
    print("Warning: Quezon City PSGC not found in division_stats.csv")

with open(csv_path_stats, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(header_stats)
    writer.writerows(rows_stats)

print("Updated division_stats.csv backup")
