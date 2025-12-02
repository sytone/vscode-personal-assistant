#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Tests the Personal Assistant MCP server journal task tools.

.DESCRIPTION
    Creates a temporary vault, adds tasks, completes them, and reads them back.
#>

$ErrorActionPreference = "Stop"

# Create temporary vault
$tempVault = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "mcp-test-vault-$(Get-Date -Format 'yyyyMMdd-HHmmss')")
Write-Host "Created test vault: $tempVault"

# Create .obsidian folder
New-Item -ItemType Directory -Path (Join-Path $tempVault ".obsidian") | Out-Null

# Create journal directory
$journalDir = New-Item -ItemType Directory -Path (Join-Path $tempVault "1 Journal")
Write-Host "Created journal directory: $journalDir"

# Set environment variable
$env:VAULT_ROOT = $tempVault.FullName

try {
    Write-Host "`n=== Testing addJournalTask ==="
    
    $addTaskRequest = @{
        jsonrpc = "2.0"
        id = 1
        method = "tools/call"
        params = @{
            name = "addJournalTask"
            arguments = @{
                taskDescription = "Test task from PowerShell"
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    $response = $addTaskRequest | node dist/mcp-server.mjs 2>$null
    Write-Host "Response:" $response
    
    Write-Host "`n=== Testing readJournalTasks ==="
    
    $readTasksRequest = @{
        jsonrpc = "2.0"
        id = 2
        method = "tools/call"
        params = @{
            name = "readJournalTasks"
            arguments = @{}
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    $response = $readTasksRequest | node dist/mcp-server.mjs 2>$null | ConvertFrom-Json
    Write-Host "Tasks:" 
    Write-Host $response.result.content[0].text
    
    Write-Host "`n=== Testing completeJournalTask ==="
    
    $completeTaskRequest = @{
        jsonrpc = "2.0"
        id = 3
        method = "tools/call"
        params = @{
            name = "completeJournalTask"
            arguments = @{
                taskDescription = "Test task"
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    $response = $completeTaskRequest | node dist/mcp-server.mjs 2>$null
    Write-Host "Response:" $response
    
    Write-Host "`n=== Verify task was completed ==="
    
    $response = $readTasksRequest | node dist/mcp-server.mjs 2>$null | ConvertFrom-Json
    Write-Host "Tasks after completion:"
    Write-Host $response.result.content[0].text
    
    # Check journal file
    $journalFiles = Get-ChildItem -Path $journalDir -Recurse -Filter "*.md"
    if ($journalFiles.Count -gt 0) {
        Write-Host "`n=== Journal file content ==="
        $journalFiles | ForEach-Object {
            Write-Host "File: $($_.FullName)"
            Get-Content $_.FullName
        }
    }
    
    Write-Host "`n=== Test completed successfully ==="
} catch {
    Write-Host "`n[ERROR] Test failed: $_"
    Write-Host $_.ScriptStackTrace
    exit 1
} finally {
    # Cleanup
    Write-Host "`nCleaning up test vault..."
    Remove-Item -Path $tempVault -Recurse -Force
    Write-Host "Test vault removed"
}
