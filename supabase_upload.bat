@echo off
chcp 65001 > nul
echo 正在上傳 books.json 至 Supabase 儲存空間...
python supabase_upload.py
pause
