#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Tests the Personal Assistant MCP server by sending a test journal entry.

.DESCRIPTION
    Creates a temporary vault, starts the MCP server, and tests the addJournalEntry tool.
#>

$ErrorActionPreference = "Stop"

# Create temporary vault
$tempVault = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "mcp-test-vault-$(Get-Date -Format 'yyyyMMdd-HHmmss')")
Write-Host "Created test vault: $tempVault"

# Create .obsidian folder to mark it as a vault
New-Item -ItemType Directory -Path (Join-Path $tempVault ".obsidian") | Out-Null

# Create journal directory
$journalDir = New-Item -ItemType Directory -Path (Join-Path $tempVault "1 Journal")
Write-Host "Created journal directory: $journalDir"

# Set environment variable
$env:VAULT_ROOT = $tempVault.FullName

try {
    Write-Host "`nStarting MCP server..."
    Write-Host "VAULT_ROOT: $env:VAULT_ROOT"
    
    # Create test request JSON for listing tools
    $listToolsRequest = @{
        jsonrpc = "2.0"
        id = 1
        method = "tools/list"
    } | ConvertTo-Json -Compress
    
    # Create test request for adding a journal entry
    $addEntryRequest = @{
        jsonrpc = "2.0"
        id = 2
        method = "tools/call"
        params = @{
            name = "addJournalEntry"
            arguments = @{
                entryContent = "Test entry from PowerShell test script"
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    Write-Host "`n=== Sending tools/list request ==="
    Write-Host $listToolsRequest
    
    # Send request to server
    $listResponse = $listToolsRequest | node dist/mcp-server.mjs
    Write-Host "`n=== Tools list response ==="
    Write-Host $listResponse
    
    Write-Host "`n=== Sending addJournalEntry request ==="
    Write-Host $addEntryRequest
    
    $addResponse = $addEntryRequest | node dist/mcp-server.mjs
    Write-Host "`n=== Add entry response ==="
    Write-Host $addResponse
    
    # Check if journal file was created
    $journalFiles = Get-ChildItem -Path $journalDir -Recurse -Filter "*.md"
    if ($journalFiles.Count -gt 0) {
        Write-Host "`n=== Journal file created ==="
        $journalFiles | ForEach-Object {
            Write-Host "File: $($_.FullName)"
            Write-Host "Content:"
            Get-Content $_.FullName
        }
    } else {
        Write-Host "`n[WARNING] No journal files created!"
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
