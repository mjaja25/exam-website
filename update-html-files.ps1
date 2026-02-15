# PowerShell script to update all HTML files with new CSS links
# Run this from the project root directory

$htmlFiles = Get-ChildItem -Path "public" -Filter "*.html"

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Check if modern-theme.css is already included
    if ($content -notmatch "modern-theme.css") {
        # Find the style.css link and add new CSS files before it
        $content = $content -replace '(<link rel="stylesheet" href="style.css")', '<link rel="stylesheet" href="modern-theme.css">`n    <link rel="stylesheet" href="enhanced-pages.css">`n    $1'
        
        # Write back to file
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Updated: $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "Skipped (already updated): $($file.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nAll HTML files have been updated!" -ForegroundColor Cyan
