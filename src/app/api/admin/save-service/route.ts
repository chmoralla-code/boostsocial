import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

export async function POST(req: NextRequest) {
  try {
    const {
      id,
      title,
      description,
      starting_price,
      icon_type,
      smmMetadata,
    } = await req.json();

    if (!title || !description || starting_price === undefined || !icon_type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const priceNum = Number(starting_price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const buildDescriptionObject = (input: unknown) => {
      if (input && typeof input === "object") {
        return { ...(input as Record<string, unknown>) };
      }

      if (typeof input === "string") {
        const trimmed = input.trim();
        if (trimmed.startsWith("{")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object") {
              return { ...(parsed as Record<string, unknown>) };
            }
          } catch {
            // Fall through to plain text wrapper
          }
        }
        return { description: trimmed };
      }

      return { description: "" };
    };

    const descriptionObj: Record<string, unknown> = buildDescriptionObject(description);

    if (smmMetadata && typeof smmMetadata === "object") {
      const meta = smmMetadata as Record<string, unknown>;

      const smmServiceId = meta.smm_service_id;
      if (smmServiceId !== undefined) {
        const asString = String(smmServiceId).trim();
        if (asString) {
          descriptionObj["smm_service_id"] = asString;
        } else {
          delete descriptionObj["smm_service_id"];
        }
      }

      const smmOriginalRate = meta.smm_original_rate;
      if (smmOriginalRate !== undefined && smmOriginalRate !== null && smmOriginalRate !== "") {
        descriptionObj["smm_original_rate"] = Number(smmOriginalRate);
      } else {
        delete descriptionObj["smm_original_rate"];
      }

      const smmMarkupPercent = meta.smm_markup_percent;
      if (smmMarkupPercent !== undefined && smmMarkupPercent !== null && smmMarkupPercent !== "") {
        descriptionObj["smm_markup_percent"] = Number(smmMarkupPercent);
      } else {
        delete descriptionObj["smm_markup_percent"];
      }

      const smmOriginalName = meta.smm_original_name;
      if (typeof smmOriginalName === "string" && smmOriginalName.trim()) {
        descriptionObj["smm_original_name"] = smmOriginalName.trim();
      } else {
        delete descriptionObj["smm_original_name"];
      }

      const smmMin = meta.smm_min;
      if (smmMin !== undefined && smmMin !== null && smmMin !== "") {
        descriptionObj["smm_min"] = Number(smmMin);
      } else {
        delete descriptionObj["smm_min"];
      }

      const smmMax = meta.smm_max;
      if (smmMax !== undefined && smmMax !== null && smmMax !== "") {
        descriptionObj["smm_max"] = Number(smmMax);
      } else {
        delete descriptionObj["smm_max"];
      }
    }

    if (id) {
      // Update existing service
      const { data, error } = await supabase
        .from("services")
        .update({
          title: title.trim(),
          description: JSON.stringify(descriptionObj),
          starting_price: priceNum,
          icon_type,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("services")
          .update({
            title: title.trim(),
            description: JSON.stringify(descriptionObj),
            starting_price: priceNum,
            icon_type,
          })
          .eq("id", id);
      }, "save-service update sync");

      return NextResponse.json({ success: true, service: data });
    } else {
      // Insert new service
      const { data, error } = await supabase
        .from("services")
        .insert([
          {
            title: title.trim(),
            description: JSON.stringify(descriptionObj),
            starting_price: priceNum,
            icon_type,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("services")
          .insert([
            {
              id: data.id,
              title: title.trim(),
              description: JSON.stringify(descriptionObj),
              starting_price: priceNum,
              icon_type,
            }
          ]);
      }, "save-service insert sync");

      return NextResponse.json({ success: true, service: data });
    }
  } catch (err: any) {
    console.error("Save service endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
