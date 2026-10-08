param(
    [Parameter(Mandatory)][ValidateSet('EditMode','PlayMode')][string]$Mode,
    [Parameter(Mandatory)][string]$ProjectPath,
    [Parameter(Mandatory)][string]$ResultsPath,
    [Parameter(Mandatory)][string]$UnityPath,
    [string]$Filter,
    [ValidateSet('2026-10-07-unity-receiver','2026-10-08-unity-quality')]
    [string]$WorkspaceName='2026-10-07-unity-receiver',
    [ValidateRange(10,900)][int]$TimeoutSeconds=300
)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskWorkspace=[IO.Path]::GetFullPath((Join-Path $taskRoot ('.superpowers/sdd/'+$WorkspaceName)))
function Assert-OwnedPath([string]$Value) {
    $taskFull=[IO.Path]::GetFullPath($Value)
    if (-not $taskFull.StartsWith($taskWorkspace+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Unity test paths must stay inside this plan workspace'
    }
    $taskAncestor=$taskFull
    while ($taskAncestor -and $taskAncestor.StartsWith($taskWorkspace,[StringComparison]::OrdinalIgnoreCase)) {
        if (Test-Path -LiteralPath $taskAncestor) {
            if ((Get-Item -LiteralPath $taskAncestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw 'Unity test paths cannot contain filesystem links'
            }
        }
        $taskAncestor=Split-Path -Path $taskAncestor -Parent
    }
    return $taskFull
}
$taskProject=Assert-OwnedPath $ProjectPath
$taskResults=Assert-OwnedPath $ResultsPath
$taskLog=$taskResults+'.log'
$taskOwnership=$taskResults+'.ownership.json'
foreach ($taskPath in @($taskResults,$taskLog,$taskOwnership)) {
    if (Test-Path -LiteralPath $taskPath) { throw 'Use fresh test output paths; prior evidence is retained' }
}
if (-not (Test-Path -LiteralPath (Join-Path $taskProject 'Packages/manifest.json'))) { throw 'Explicit Unity test manifest is required' }
$taskEditor=[IO.Path]::GetFullPath($UnityPath)
if (-not (Test-Path -LiteralPath $taskEditor -PathType Leaf)) { throw 'Installed Unity Editor was not found' }
New-Item -ItemType Directory -Path (Split-Path $taskResults -Parent) -Force | Out-Null
$taskArgs=@('-batchmode','-nographics','-projectPath',('"'+$taskProject+'"'),'-runTests','-testPlatform',$Mode,
    '-testResults',('"'+$taskResults+'"'),'-logFile',('"'+$taskLog+'"'))
if ($Filter) {
    if ($Filter -notmatch '^[A-Za-z0-9_.;]+$') { throw 'Invalid Unity test filter' }
    $taskArgs+=@('-testFilter',$Filter)
}
$taskProcess=Start-Process -FilePath $taskEditor -ArgumentList $taskArgs -Environment @{ALLUSERSPROFILE=$env:ProgramData} -WindowStyle Hidden -PassThru
$taskUtf8=[Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText($taskOwnership,(@{pid=$taskProcess.Id;project=$taskProject;results=$taskResults;startedUtc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json),$taskUtf8)
if (-not $taskProcess.WaitForExit($TimeoutSeconds*1000)) {
    $taskProcess.Kill();$taskProcess.WaitForExit()
    throw 'Owned Unity test process timed out; evidence retained'
}
if (-not (Test-Path -LiteralPath $taskResults -PathType Leaf)) { throw 'Unity did not produce test XML; inspect retained Editor log' }
$taskReaderSettings=[Xml.XmlReaderSettings]::new()
$taskReaderSettings.DtdProcessing=[Xml.DtdProcessing]::Prohibit
$taskReaderSettings.XmlResolver=$null
$taskReaderSettings.MaxCharactersInDocument=16MB
$taskReader=[Xml.XmlReader]::Create($taskResults,$taskReaderSettings)
try {
    $taskXml=[Xml.XmlDocument]::new();$taskXml.XmlResolver=$null;$taskXml.Load($taskReader)
} finally { $taskReader.Dispose() }
$taskRun=$taskXml.DocumentElement
$taskSummary=[ordered]@{mode=$Mode;pid=$taskProcess.Id;exitCode=$taskProcess.ExitCode;result=$taskRun.GetAttribute('result');
    total=$taskRun.GetAttribute('total');passed=$taskRun.GetAttribute('passed');failed=$taskRun.GetAttribute('failed');results=$taskResults}
$taskSummary | ConvertTo-Json -Compress
if ($taskProcess.ExitCode -ne 0 -or $taskRun.Name -ne 'test-run' -or $taskRun.GetAttribute('result') -ne 'Passed' -or
    [int]$taskRun.GetAttribute('failed') -ne 0 -or [int]$taskRun.GetAttribute('passed') -lt 1) {
    throw 'Actual Unity tests did not pass; XML/log evidence retained'
}
