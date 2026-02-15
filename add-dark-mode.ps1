# PowerShell script to add dark mode support to all HTML files
# Run this from the project root directory

$htmlFiles = Get-ChildItem -Path "public" -Filter "*.html"

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Check if dark-mode.css is already included
    if ($content -notmatch "dark-mode.css") {
        # Add dark-mode.css after modern-theme.css
        $content = $content -replace '(<link rel="stylesheet" href="modern-theme.css">)', '$1`n    <link rel="stylesheet" href="dark-mode.css">'
        
        # Add theme-toggle.js before closing </body> tag
        if ($content -notmatch "theme-toggle.js") {
            $content = $content -replace '(</body>)', '    <script src="theme-toggle.js"></script>`n$1'
        }
        
        # Write back to file
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Updated: $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "Skipped (already updated): $($file.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nDark mode support added to all HTML files!" -ForegroundColor Cyan
Write-Host "Users can now toggle between light and dark mode!" -ForegroundColor Cyan
