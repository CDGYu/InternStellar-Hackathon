import { Horizon } from "@stellar/stellar-sdk";

export function getHorizonServer(): Horizon.Server {
  const url = process.env.STELLAR_HORIZON_URL;
  if (!url) {
    throw new Error(
      "STELLAR_HORIZON_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return new Horizon.Server(url);
}
