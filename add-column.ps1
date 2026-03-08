$sql = "ALTER TABLE Sale ADD COLUMN referenceNumber VARCHAR(255) NULL;"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root inventory_pos -e $sql
Write-Host "Database column added successfully"
