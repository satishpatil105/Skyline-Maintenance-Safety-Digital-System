import { NextResponse } from "next/server";

/**
 * Wrap an API route so an unexpected error (Excel file locked,
 * someone else edited the row...) comes back as JSON the UI
 * can show, instead of an HTML 500 page.
 */
export function safe<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Compared by name, not instanceof: Next.js can load this module twice
      // (once per route bundle), which would make instanceof fail.
      const conflict = error instanceof Error && error.name === "ConflictError";
      if (!conflict) console.error(error);
      return NextResponse.json(
        {
          success: false,
          message: error instanceof Error ? error.message : "Something went wrong.",
        },
        { status: conflict ? 409 : 500 }
      );
    }
  };
}
