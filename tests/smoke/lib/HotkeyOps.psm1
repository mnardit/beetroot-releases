# tests/smoke/lib/HotkeyOps.psm1
# Synthesize Ctrl+` (default Beetroot hotkey) and probe whether the Beetroot
# popup window is currently visible.
#
# Note: the -ErrorAction SilentlyContinue on Add-Type is intentional. If the
# type is already defined from a previous module load in the same session,
# Add-Type errors. Suppressing keeps subsequent imports idempotent.

Add-Type -ErrorAction SilentlyContinue -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class HotkeySender {
    [DllImport("user32.dll")]
    public static extern uint keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);

    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_OEM_3   = 0xC0; // backtick `

    public static void SendCtrlBacktick() {
        keybd_event(VK_CONTROL, 0, 0, IntPtr.Zero);
        keybd_event(VK_OEM_3,   0, 0, IntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_OEM_3,   0, KEYEVENTF_KEYUP, IntPtr.Zero);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
    }
}
"@

Add-Type -ErrorAction SilentlyContinue -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class BeetrootWinProbe {
    // The copy overlay is also a Tauri Window, but has an empty title.
    // Match the smoke popup's title as well as its class and owning process.

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    public const string TauriWindowClass = "Tauri Window";

    public static bool IsSmokePopup(string windowClass, string title) {
        return windowClass == TauriWindowClass && title == "Beetroot Smoke";
    }

    public static bool IsTauriWindowVisible(uint pid) {
        bool found = false;
        EnumWindows((hWnd, lParam) => {
            uint windowPid;
            GetWindowThreadProcessId(hWnd, out windowPid);
            if (windowPid == pid && IsWindowVisible(hWnd)) {
                var sb = new StringBuilder(256);
                GetClassNameW(hWnd, sb, sb.Capacity);
                var title = new StringBuilder(256);
                GetWindowTextW(hWnd, title, title.Capacity);
                if (IsSmokePopup(sb.ToString(), title.ToString())) {
                    found = true;
                    return false; // stop enumeration
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

function Send-CtrlBacktick {
    <#
    .SYNOPSIS
    Sends a synthetic Ctrl+` keystroke at the OS level via keybd_event.
    #>
    [HotkeySender]::SendCtrlBacktick()
}

function Test-BeetrootWindowVisible {
    <#
    .SYNOPSIS
    Returns $true if the Beetroot Smoke popup is currently visible.

    .DESCRIPTION
    Enumerates every top-level window owned by the Beetroot process and looks
    for the "Tauri Window" class with the "Beetroot Smoke" title. Filtering
    only by class would also match the copy overlay, while MainWindowHandle
    can point to an auxiliary window instead of the popup.
    #>
    param([Parameter(Mandatory)][System.Diagnostics.Process]$Process)
    if ($Process.HasExited) { return $false }
    return [BeetrootWinProbe]::IsTauriWindowVisible([uint32]$Process.Id)
}

function Wait-BeetrootWindowVisible {
    <#
    .SYNOPSIS
    Polls Test-BeetrootWindowVisible until $ExpectedState matches or the
    timeout expires.

    .DESCRIPTION
    Beetroot's popup appears asynchronously after the hotkey thread receives
    the Ctrl+` event (RegisterHotKey -> WM_HOTKEY -> ShowWindow on the UI
    thread). On a cold first-press the round-trip can vary from ~200ms to
    >1s while WebView2 finishes initializing. Polling avoids the brittleness
    of fixed-interval Start-Sleep checks.

    .PARAMETER ExpectedState
    The visibility state being waited for. $true = window appears,
    $false = window hides.

    .PARAMETER TimeoutMs
    Maximum total wait, in milliseconds. Defaults to 3000.

    .OUTPUTS
    [bool] $true if the expected state was observed within TimeoutMs.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.Diagnostics.Process]$Process,
        [Parameter(Mandatory)][bool]$ExpectedState,
        [int]$TimeoutMs = 3000
    )
    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    while ((Get-Date) -lt $deadline) {
        if ($Process.HasExited) { throw "Smoke process exited while waiting for its window." }
        if ((Test-BeetrootWindowVisible -Process $Process) -eq $ExpectedState) { return $true }
        Start-Sleep -Milliseconds 100
    }
    return $false
}

Export-ModuleMember -Function Send-CtrlBacktick, Test-BeetrootWindowVisible, Wait-BeetrootWindowVisible
