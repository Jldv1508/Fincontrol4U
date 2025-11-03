Param(
    [int]$Port = 8000
)

Add-Type -AssemblyName System.Net
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    Write-Host "Port $Port busy, trying 8001"
    $Port = 8001
    $prefix = "http://localhost:$Port/"
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "Serving $prefix"

function Get-MimeType($path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    switch ($ext) {
        '.html' { 'text/html' }
        '.htm'  { 'text/html' }
        '.css'  { 'text/css' }
        '.js'   { 'application/javascript' }
        '.json' { 'application/json' }
        '.png'  { 'image/png' }
        '.jpg'  { 'image/jpeg' }
        '.jpeg' { 'image/jpeg' }
        '.svg'  { 'image/svg+xml' }
        default { 'application/octet-stream' }
    }
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $local = $req.Url.LocalPath
    if ([string]::IsNullOrEmpty($local) -or $local -eq '/') { $local = '/index.html' }
    $file = Join-Path (Get-Location) ($local.TrimStart('/'))
    if (Test-Path $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $res.ContentType = Get-MimeType -path $file
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.Close()
}