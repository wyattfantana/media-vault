# Start Bazarr Container
Write-Host "🎬 Starting Bazarr..." -ForegroundColor Cyan

try {
    # Navigate to project directory
    $projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    Set-Location $projectDir

    # Start Bazarr container
    docker compose up -d bazarr

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Bazarr started successfully!" -ForegroundColor Green
        Write-Host "   Access at: http://localhost:6767" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📝 Next steps:" -ForegroundColor Cyan
        Write-Host "   1. Go to http://localhost:6767" -ForegroundColor White
        Write-Host "   2. Complete initial setup" -ForegroundColor White
        Write-Host "   3. Get API key from Settings → General → Security" -ForegroundColor White
        Write-Host "   4. Configure in MediaVault Settings → Subtitles tab" -ForegroundColor White
    } else {
        throw "Docker command failed"
    }
} catch {
    Write-Host "❌ Failed to start Bazarr" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Use Docker Desktop GUI" -ForegroundColor Yellow
    Write-Host "1. Open Docker Desktop" -ForegroundColor White
    Write-Host "2. Go to Containers tab" -ForegroundColor White
    Write-Host "3. Find 'bazarr' container" -ForegroundColor White
    Write-Host "4. Click Start button" -ForegroundColor White
}
