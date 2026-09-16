# يدخل المستخدم الأسرار محليًا؛ لا يطبع هذا السكربت أي قيمة على الشاشة.
function Reveal-SecureString([Security.SecureString] $Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$discordToken = Read-Host 'الصق توكن Discord الجديد' -AsSecureString
$spotifyClientId = Read-Host 'الصق Spotify Client ID'
$spotifyClientSecret = Read-Host 'الصق Spotify Client Secret الجديد' -AsSecureString
$nodeLinkPassword = Read-Host 'اكتب كلمة مرور قوية لـ NodeLink' -AsSecureString

$envFile = Join-Path $PSScriptRoot '.env'
$content = @(
  "DISCORD_TOKEN=$(Reveal-SecureString $discordToken)",
  "NODELINK_HOST=127.0.0.1",
  "NODELINK_PORT=2333",
  "NODELINK_PASSWORD=$(Reveal-SecureString $nodeLinkPassword)",
  "SPOTIFY_CLIENT_ID=$spotifyClientId",
  "SPOTIFY_CLIENT_SECRET=$(Reveal-SecureString $spotifyClientSecret)",
  "BOT_OWNERS="
) -join [Environment]::NewLine

[System.IO.File]::WriteAllText($envFile, $content + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Host 'تم إنشاء ملف .env محليًا. لم تُعرض أي أسرار.' -ForegroundColor Green
