//! Static lifecycle guard; real second-instance focus is checked in a test VM.

#[test]
fn database_startup_is_deferred_until_after_single_instance_plugins() {
    let source = include_str!("../src/lib.rs");
    let run = source.split_once("pub fn run() {").unwrap().1;
    let (before_setup, setup) = run.split_once("builder.setup(|app| {").unwrap();
    let setup = setup.split_once(".invoke_handler(").unwrap().0;

    assert!(before_setup.contains(".plugin(tauri_plugin_single_instance::init("));
    assert!(before_setup.contains("window::show_on_active_monitor(&w, true)"));
    for operation in [
        "resolve_data_dir()",
        "backup::check_force_recovery(",
        "open_db_with_retry(",
        "prepare_database(",
        "backup::backup_before_migration(",
        "migrations::run_migrations(",
        "seed_own_app_icon(",
        "commands::cleanup_broken_image_records(",
        "commands::reconcile_orphaned_images(",
    ] {
        assert!(
            !before_setup.contains(operation),
            "{operation} must not run before the single-instance check"
        );
        assert!(setup.contains(operation), "missing setup step: {operation}");
    }
    let database_ready = setup.find("app.manage(DbPool(").unwrap();
    assert!(database_ready < setup.find("jobs::start_worker(").unwrap());
    assert!(database_ready < setup.find("backup::start_backup_thread(").unwrap());
}
