declare namespace Deno {
  export interface ServeOptions {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
    onListen?: (params: { port: number; hostname: string }) => void;
  }

  export function serve(
    handler: (request: Request, info: any) => Response | Promise<Response>,
    options?: ServeOptions
  ): any;

  export const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): { [key: string]: string };
  };
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export const createClient: any;
}
