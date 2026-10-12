param([Parameter(Mandatory=$true)][string]$Handle,[Parameter(Mandatory=$true)][string]$Shortcut,[Parameter(Mandatory=$true)][string]$Icon,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NotesNativeIconCheck {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
 public struct Info { public IntPtr icon; public int index; public uint attributes; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string display; [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)] public string type; }
 [DllImport("shell32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SHGetFileInfo(string path,uint attributes,ref Info info,uint size,uint flags);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr window,uint message,IntPtr wParam,IntPtr lParam);
 [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr icon);
}
'@
New-Item -ItemType Directory -Path $Output -Force | Out-Null
function Measure-Icon([IntPtr]$taskHandle,[string]$taskName) {
 if ($taskHandle -eq [IntPtr]::Zero) { throw "$taskName has no native Windows icon." }
 $taskImage = [Drawing.Icon]::FromHandle($taskHandle).ToBitmap()
 try {
  $taskImage.Save((Join-Path $Output ($taskName+'.png')),[Drawing.Imaging.ImageFormat]::Png)
  $taskBlue=0; $taskOpaque=0
  for ($taskY=0;$taskY -lt $taskImage.Height;$taskY++) { for ($taskX=0;$taskX -lt $taskImage.Width;$taskX++) { $taskPixel=$taskImage.GetPixel($taskX,$taskY); if ($taskPixel.A -ge 128) { $taskOpaque++; if ($taskPixel.B -gt $taskPixel.R+35 -and $taskPixel.G -gt $taskPixel.R+35) { $taskBlue++ } } } }
  if ($taskOpaque -eq 0 -or $taskBlue/[double]$taskOpaque -lt 0.2) { throw "$taskName does not display the blue notepad artwork." }
  return [pscustomobject]@{Name=$taskName;Width=$taskImage.Width;Height=$taskImage.Height;BlueFraction=[Math]::Round($taskBlue/[double]$taskOpaque,3)}
 } finally { $taskImage.Dispose() }
}
$taskWindow = [IntPtr]::new([long]::Parse($Handle))
$taskResults = @()
foreach ($taskKind in @(0,1)) { $taskHicon=[NotesNativeIconCheck]::SendMessage($taskWindow,0x7f,[IntPtr]::new($taskKind),[IntPtr]::Zero); $taskResults += Measure-Icon $taskHicon ('window-'+$taskKind) }
foreach ($taskPair in @(@('shortcut',$Shortcut),@('resource',$Icon))) {
 $taskInfo=New-Object NotesNativeIconCheck+Info
 $taskExtracted=[NotesNativeIconCheck]::SHGetFileInfo($taskPair[1],0,[ref]$taskInfo,[Runtime.InteropServices.Marshal]::SizeOf($taskInfo),0x100)
 if ($taskExtracted -eq [IntPtr]::Zero) { throw 'Windows Shell could not resolve the icon.' }
 try { $taskResults += Measure-Icon $taskInfo.icon $taskPair[0] } finally { [NotesNativeIconCheck]::DestroyIcon($taskInfo.icon) | Out-Null }
}
$taskResults | ConvertTo-Json -Compress
