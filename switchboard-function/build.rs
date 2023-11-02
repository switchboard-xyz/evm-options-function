fn main() {
    println!("cargo:rerun-if-env-changed=CALLBACK_ADDRESS");
    // Read the environment variable
    let value = std::env::var("CALLBACK_ADDRESS").expect("CALLBACK_ADDRESS must be set");

    // Pass it to the Rust compiler
    println!("cargo:rustc-env=CALLBACK_ADDRESS={}", value);
}
