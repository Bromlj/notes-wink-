param([switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version = '5.3.3'
$archiveName = "Notes-Workspace-Desktop-$version-Windows-x64.zip"
$downloadUrl = "https://github.com/Bromlj/notes-wink-/releases/download/v$version/$archiveName"
$expectedHash = 'c9222df6eeea990af47c3bfc4e6a2c1d060994f292a178b4cc4f3f12ba471bb3'
if (!$VerifyOnly) {
    $installedExe = Join-Path $env:LOCALAPPDATA 'NotesWorkspace\DesktopProgram\Notes Workspace.exe'
    if (@(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $installedExe }).Count) { throw 'Close Notes Workspace, then run Get-App.cmd again.' }
}
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$downloadRoot = [IO.Path]::GetFullPath((Join-Path $tempRoot ('NotesWorkspace-Download-' + [guid]::NewGuid().ToString('N'))))
$parentRoot = [IO.Path]::GetFullPath((Split-Path -Parent $downloadRoot)).TrimEnd('\','/')
if ($parentRoot -ne $tempRoot.TrimEnd('\','/')) { throw 'Unexpected download folder.' }
$archivePath = Join-Path $downloadRoot $archiveName
try {
    New-Item -ItemType Directory -Path $downloadRoot | Out-Null
    Write-Host "Downloading Notes Workspace $version for Windows x64 (about 326 MB)..."
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -UseBasicParsing
    $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHash) { throw 'The download checksum did not match. Installation was not started.' }
    Write-Host 'Download checksum verified.'
    if ($VerifyOnly) { return }
    $unpackedRoot = Join-Path $downloadRoot 'unpacked'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $unpackedRoot
    $programRoot = Join-Path $unpackedRoot 'Notes Workspace'
    $installer = Join-Path $programRoot 'Install.ps1'
    if (!(Test-Path -LiteralPath $installer -PathType Leaf) -or !(Test-Path -LiteralPath (Join-Path $programRoot 'Notes Workspace.exe') -PathType Leaf)) { throw 'The download did not contain the expected Windows program.' }
    & $installer
} finally {
    # Delete only the exact temporary directory created above. Never recurse
    # outside the verified temp parent or follow a substituted junction.
    if (Test-Path -LiteralPath $downloadRoot) {
        $item = Get-Item -LiteralPath $downloadRoot -Force
        $resolved = [IO.Path]::GetFullPath($item.FullName)
        $resolvedParent = [IO.Path]::GetFullPath((Split-Path -Parent $resolved)).TrimEnd('\','/')
        if ($resolved -eq $downloadRoot -and $resolvedParent -eq $tempRoot.TrimEnd('\','/') -and !($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            Remove-Item -LiteralPath $downloadRoot -Recurse -Force
        }
    }
}
