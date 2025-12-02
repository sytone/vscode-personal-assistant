#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Tests the readJournalEntries MCP tool.
#>

$ErrorActionPreference = "Stop"

$tempVault = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "mcp-test-vault-$(Get-Date -Format 'yyyyMMdd-HHmmss')")
Write-Host "Created test vault: $tempVault"

New-Item -ItemType Directory -Path (Join-Path $tempVault ".obsidian") | Out-Null
$journalDir = New-Item -ItemType Directory -Path (Join-Path $tempVault "1 Journal")

$env:VAULT_ROOT = $tempVault.FullName

try {
    Write-Host "`n=== Adding journal entries ==="
    
    # Add entry 1
    $addEntry1 = @{
        jsonrpc = "2.0"
        id = 1
        method = "tools/call"
        params = @{
            name = "addJournalEntry"
            arguments = @{
                entryContent = "First entry for testing"
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    $response = $addEntry1 | node dist/mcp-server.mjs 2>$null
    Write-Host "Added entry 1"
    
    # Add entry 2
    $addEntry2 = @{
        jsonrpc = "2.0"
        id = 2
        method = "tools/call"
        params = @{
            name = "addJournalEntry"
            arguments = @{
                entryContent = "Second entry for testing"
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    $response = $addEntry2 | node dist/mcp-server.mjs 2>$null
    Write-Host "Added entry 2"
    
    Write-Host "`n=== Reading journal entries (list only) ==="
    
    $readEntriesListRequest = @{
        jsonrpc = "2.0"
        id = 3
        method = "tools/call"
        params = @{
            name = "readJournalEntries"
            arguments = @{
                maxEntries = 5
                includeContent = $false
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    $response = $readEntriesListRequest | node dist/mcp-server.mjs 2>$null | ConvertFrom-Json
    Write-Host $response.result.content[0].text
    
    Write-Host "`n=== Reading journal entries (with content) ==="
    
    $readEntriesContentRequest = @{
        jsonrpc = "2.0"
        id = 4
        method = "tools/call"
        params = @{
            name = "readJournalEntries"
            arguments = @{
                maxEntries = 1
                includeContent = $true
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    $response = $readEntriesContentRequest | node dist/mcp-server.mjs 2>$null | ConvertFrom-Json
    Write-Host $response.result.content[0].text
    
    Write-Host "`n=== Test completed successfully ==="
} catch {
    Write-Host "`n[ERROR] Test failed: $_"
    Write-Host $_.ScriptStackTrace
    exit 1
} finally {
    Write-Host "`nCleaning up test vault..."
    Remove-Item -Path $tempVault -Recurse -Force
    Write-Host "Test vault removed"
}
