/** Module-level flag to suppress window reset while a native dialog is open. */
export let dialogActive = false;
export function setDialogActive(active: boolean) {
  dialogActive = active;
}
