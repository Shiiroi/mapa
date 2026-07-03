import openpyxl
excel_path = "/Users/vince/personal-projects/mapa/mapa/frontend/data-sets/source/4_Household Population by Age Group and Sex_Philippines_2020 CPH_rev.xlsx"
wb = openpyxl.load_workbook(excel_path, read_only=True)
ws = wb['NCR']
for i, row in enumerate(ws.iter_rows(max_row=100, max_col=10, values_only=True)):
    print(f"Row {i+1}: {row}")
