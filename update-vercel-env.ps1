$envs = @("production")
# Values are read from the current environment so no secrets are committed.
# Set these before running, e.g. via a local (git-ignored) .env or your shell.
$vars = @{
    "NEXT_PUBLIC_SUPABASE_URL" = $env:NEXT_PUBLIC_SUPABASE_URL
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
    "SUPABASE_SERVICE_ROLE_KEY" = $env:SUPABASE_SERVICE_ROLE_KEY
    "DATABASE_URL" = $env:DATABASE_URL
}

foreach ($key in $vars.Keys) {
    if ([string]::IsNullOrEmpty($vars[$key])) {
        Write-Error "Missing required environment variable: $key. Set it before running this script."
        exit 1
    }
}

foreach ($key in $vars.Keys) {
    foreach ($env in $envs) {
        $val = $vars[$key]
        Write-Host "Updating $key for $env..."
        npx vercel env rm $key $env --yes 2>$null
        cmd.exe /c "echo $val| npx vercel env add $key $env --yes"
    }
}
