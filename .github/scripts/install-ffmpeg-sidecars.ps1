$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
$binaryDirectory = Join-Path (Join-Path $repositoryRoot 'src-tauri') 'binaries'
New-Item -ItemType Directory -Force -Path $binaryDirectory | Out-Null
$tempDirectory = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [System.IO.Path]::GetTempPath() }

$rustDetails = rustc -vV
$hostTripleLine = $rustDetails | Where-Object { $_ -like 'host: *' } | Select-Object -First 1

if (-not $hostTripleLine) {
  throw 'Unable to determine Rust host triple from `rustc -vV`.'
}

$hostTriple = $hostTripleLine.Substring(6).Trim()

switch -Wildcard ($hostTriple) {
  '*windows-msvc' {
    $archivePath = Join-Path $tempDirectory 'ffmpeg.zip'
    $extractPath = Join-Path $tempDirectory 'ffmpeg'

    Invoke-WebRequest `
      -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' `
      -OutFile $archivePath
    Expand-Archive -Path $archivePath -DestinationPath $extractPath -Force

    $ffmpeg = Get-ChildItem $extractPath -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
    $ffprobe = Get-ChildItem $extractPath -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1

    if (-not $ffmpeg -or -not $ffprobe) {
      throw 'FFmpeg or FFprobe was not found in the downloaded Windows archive.'
    }

    Copy-Item `
      -Path $ffmpeg.FullName `
      -Destination (Join-Path $binaryDirectory "ffmpeg-$hostTriple.exe") `
      -Force
    Copy-Item `
      -Path $ffprobe.FullName `
      -Destination (Join-Path $binaryDirectory "ffprobe-$hostTriple.exe") `
      -Force
  }
  '*apple-darwin' {
    if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
      throw 'Homebrew is required to install macOS FFmpeg sidecars in CI.'
    }

    brew install ffmpeg

    $brewPrefix = brew --prefix ffmpeg
    $ffmpeg = Join-Path (Join-Path $brewPrefix 'bin') 'ffmpeg'
    $ffprobe = Join-Path (Join-Path $brewPrefix 'bin') 'ffprobe'

    if (-not (Test-Path $ffmpeg) -or -not (Test-Path $ffprobe)) {
      throw 'FFmpeg or FFprobe was not found in the Homebrew ffmpeg package.'
    }

    $ffmpegDestination = Join-Path $binaryDirectory "ffmpeg-$hostTriple"
    $ffprobeDestination = Join-Path $binaryDirectory "ffprobe-$hostTriple"

    Copy-Item -Path $ffmpeg -Destination $ffmpegDestination -Force
    Copy-Item -Path $ffprobe -Destination $ffprobeDestination -Force

    chmod +x $ffmpegDestination
    chmod +x $ffprobeDestination
  }
  default {
    throw "Unsupported Rust host triple for FFmpeg sidecars: $hostTriple"
  }
}

Write-Host "Installed FFmpeg sidecars for $hostTriple into $binaryDirectory"
