import "server-only";
import type { TrainingSample } from "./samples";
import { db } from "./supabase";

export { buildSamples, boxFor, countsOf } from "./samples";
export type { TrainingSample } from "./samples";

/**
 * Collecting the dataset for a model that could one day count these tally marks.
 *
 * Every confirmed review produces the one thing no public corpus contains: a
 * cell from this form, in this teacher's hand, with a human-verified count next
 * to what the machine thought it was. MNIST and IAM teach character identity;
 * the open questions here are "how many" and "what does this teacher's shorthand
 * mean", which only these pages answer.
 *
 * Costs nothing to collect and can't be backfilled — the photos alone don't
 * record where a human disagreed. Whether it's ever worth training on is a
 * decision for later, once there's enough of it to tell.
 */

/**
 * Write samples, never at the cost of the save that produced them.
 *
 * This is bookkeeping for a maybe-someday model; a parent saving a school day
 * must not see an error because of it. Failures are swallowed deliberately.
 */
export async function recordSamples(samples: TrainingSample[]): Promise<void> {
  if (samples.length === 0) return;
  try {
    await db().from("harper_training_samples").insert(samples);
  } catch {
    /* collecting training data is never worth failing a save over */
  }
}

export type TrainingStats = {
  samples: number;
  corrected: number;
  withCrop: number;
  days: number;
};

export async function trainingStats(): Promise<TrainingStats | null> {
  try {
    const { data, error } = await db()
      .from("harper_training_samples")
      .select("log_date, corrected, image_path");
    if (error || !data) return null;
    return {
      samples: data.length,
      corrected: data.filter((r) => r.corrected).length,
      withCrop: data.filter((r) => r.image_path).length,
      days: new Set(data.map((r) => r.log_date)).size,
    };
  } catch {
    return null;
  }
}
