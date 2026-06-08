$envs = @("production")
$vars = @{
    "NEXT_PUBLIC_SUPABASE_URL" = "https://qayiukxguqxewqmhfoes.supabase.co"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFheWl1a3hndXF4ZXdxbWhmb2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4ODQ3NTIsImV4cCI6MjA5NjQ2MDc1Mn0.vhe-KJjnR5Yfab-qRbVJCSPMuTk_gxzkJncqzzkRquo"
    "SUPABASE_SERVICE_ROLE_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFheWl1a3hndXF4ZXdxbWhmb2VzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg4NDc1MiwiZXhwIjoyMDk2NDYwNzUyfQ.JwQRY1rm181U20faJoSliUPjF0uLEeX1DHoZhNqzKEM"
    "DATABASE_URL" = "postgresql://postgres.qayiukxguqxewqmhfoes:Baholobot12345@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
}

foreach ($key in $vars.Keys) {
    foreach ($env in $envs) {
        $val = $vars[$key]
        Write-Host "Updating $key for $env..."
        npx vercel env rm $key $env --yes 2>$null
        cmd.exe /c "echo $val| npx vercel env add $key $env --yes"
    }
}
