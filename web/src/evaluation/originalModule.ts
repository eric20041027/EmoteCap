/** Kept separate so tests can observe the import boundary without executing untrusted fixtures. */
export async function importOriginalModule(url:string):Promise<unknown>{return import(/* @vite-ignore */ url);}
