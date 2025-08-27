"use client";

import { revalidateTagAction, revalidatePathAction } from "@/app/api/revalidate/action";

export default function RevalidationButtons() {
    return (
        <div className="flex gap-2">
            <button
                data-testid="revalidate-tag"
                onClick={async () => {
                    await revalidateTagAction();
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Invalidate tag
            </button>

            <button
                data-testid="revalidate-path"
                onClick={async () => {
                    await revalidatePathAction();
                }}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
                Invalidate Path
            </button>
        </div>
    );
}