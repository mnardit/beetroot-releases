# tests/smoke/lib/ClipboardOps.psm1
# Thin wrappers over System.Windows.Forms.Clipboard for the smoke harness.
# run-smoke.ps1 re-launches pwsh with -Sta so these calls are safe.

Add-Type -AssemblyName System.Windows.Forms

function Set-ClipboardText {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string]$Text
    )
    [System.Windows.Forms.Clipboard]::SetText($Text)
}

function Get-ClipboardText {
    [System.Windows.Forms.Clipboard]::GetText()
}

function Clear-ClipboardSafe {
    [System.Windows.Forms.Clipboard]::Clear()
}

Export-ModuleMember -Function Set-ClipboardText, Get-ClipboardText, Clear-ClipboardSafe
