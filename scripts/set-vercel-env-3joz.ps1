# Apply Supabase env vars to Vercel project current-supply-3joz (currentsupplys-projects).
# Run while logged into the Vercel account that owns that team:
#   npx vercel login
#   npx vercel teams switch currentsupplys-projects
#   .\scripts\set-vercel-env-3joz.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"

if (-not (Test-Path $envFile)) {
  throw "Missing $envFile — add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_.Split('=', 2)
  $vars[$name.Trim()] = $value.Trim().Trim('"').Trim("'")
}

$required = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
)
foreach ($name in $required) {
  if (-not $vars[$name]) { throw "Missing $name in .env.local" }
}

$scope = "currentsupplys-projects"
$project = "current-supply-3joz"
$environments = @("production", "preview", "development")

Write-Host "Linking $scope/$project ..."
npx vercel link --yes --scope $scope --project $project
if ($LASTEXITCODE -ne 0) {
  throw @"
Could not link $scope/$project.
Fix: log into the account that owns currentsupplys-projects, then:
  npx vercel login
  npx vercel teams switch currentsupplys-projects
  npx vercel link --yes --scope currentsupplys-projects --project current-supply-3joz
"@
}

foreach ($name in $required) {
  foreach ($envName in $environments) {
    Write-Host "Setting $name ($envName) ..."
    # Remove existing value if present so add succeeds non-interactively
    npx vercel env rm $name $envName --yes --scope $scope 2>$null | Out-Null
    $vars[$name] | npx vercel env add $name $envName --scope $scope
    if ($LASTEXITCODE -ne 0) { throw "Failed to add $name for $envName" }
  }
}

Write-Host "Redeploying production ..."
npx vercel --prod --yes --scope $scope
if ($LASTEXITCODE -ne 0) { throw "Production deploy failed" }

Write-Host "Verifying https://current-supply-3joz.vercel.app/api/categories ..."
$res = Invoke-WebRequest -Uri "https://current-supply-3joz.vercel.app/api/categories" -UseBasicParsing
if ($res.StatusCode -ne 200) { throw "Expected 200, got $($res.StatusCode)" }
if ($res.Content -notmatch '^\s*\[') { throw "Expected JSON array, got: $($res.Content.Substring(0,120))" }
Write-Host "OK $($res.StatusCode) — categories loaded."
