@echo off
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root inventory_pos -e "ALTER TABLE Sale ADD COLUMN referenceNumber VARCHAR(255) NULL;"
echo Database column added successfully
