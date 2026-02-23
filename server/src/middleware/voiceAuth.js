import { supabase } from "../lib/supabase.js";

const VOICE_API_KEY = process.env.VOICE_API_KEY;
const HEADER_API_KEY = "x-api-key";

/**
 * Authenticate voice API requests and resolve hospital
 * Supports Bolna, Plivo, Twilio
 */
export async function voiceAuth(req, res, next) {

  try {

    // 1. Validate API key
    const apiKey =
      req.headers[HEADER_API_KEY] ??
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    if (!VOICE_API_KEY || apiKey !== VOICE_API_KEY) {
      return res.status(401).json({
        error: "Missing or invalid API key",
      });
    }

    // 2. Get hospital number from call (any provider header)
    let toNumber =
      req.headers["x-hospital-number"] ||
      req.headers["agent_number"] ||
      req.headers["x-agent-number"] ||
      req.headers["x-plivo-to-number"] ||
      req.headers["x-twilio-to-number"];

    if (!toNumber || typeof toNumber !== "string") {
      return res.status(400).json({
        error: "Missing hospital number header (x-hospital-number or x-twilio-to-number). Must be set from call context.",
      });
    }

    toNumber = toNumber.trim().replace(/\s/g, "");
    // Strip template braces if platform sends e.g. {+918035735856} or {{agent_number}}
    const braceMatch = toNumber.match(/^\{\{?(.+?)\}\}?$/);
    if (braceMatch) toNumber = braceMatch[1].trim();

    // Reject if still not a phone (e.g. unsubstituted {{agent_number}})
    if (!/^\+?[0-9]{10,15}$/.test(toNumber.replace(/\s/g, ""))) {
      return res.status(400).json({
        error: "Invalid hospital number. x-hospital-number must be the actual number the user called (e.g. +918035735856), not a variable name. Check that Bolna substitutes {{agent_number}} with the call's 'to' number.",
      });
    }

    // Build variants (with/without +) so we match DB regardless of format
    const variants = [toNumber];
    if (toNumber.startsWith("+")) variants.push(toNumber.slice(1));
    else variants.push("+" + toNumber);

    // 3. Resolve hospital from DB (try each variant; hospitals.twilio_number may be stored with or without +)
    let hospital = null;
    let usedNumber = toNumber;
    for (const v of variants) {
      const { data: h, error } = await supabase
        .from("hospitals")
        .select("id")
        .eq("twilio_number", v)
        .maybeSingle();
      if (error) {
        return res.status(500).json({
          error: "Failed to resolve hospital",
        });
      }
      if (h) {
        hospital = h;
        usedNumber = v;
        break;
      }
    }

    if (!hospital) {
      return res.status(404).json({
        error: "Hospital not found for this number. Ensure x-hospital-number is the number the user called (from call context) and it exists in hospitals.twilio_number.",
      });
    }

    // 4. Attach hospital to request
    req.hospitalId = hospital.id;

    req.voiceContext = {
      to_number: usedNumber,
    };

    next();

  } catch (err) {

    return res.status(500).json({
      error: err.message,
    });

  }
}