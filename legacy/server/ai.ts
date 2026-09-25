import { GoogleGenAI, Type } from '@google/genai';
import { ExtractedOrderData, ExtractedProductItem } from '../src/types/order.js';
import { db } from './db.js';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Convert Bengali numerals (০-৯) to English digits (0-9)
export function convertBengaliDigits(str: string): string {
  const bengaliNumerals: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };
  return (str || '').replace(/[০-৯]/g, (char) => bengaliNumerals[char] || char);
}

const SYSTEM_EXTRACTION_PROMPT = `You are a specialized e-commerce order extraction engine for Bangladesh stores (Bengali, Banglish, English).
Extract customer order information from the raw message into a STRICT JSON object with this EXACT schema:
{
  "customerName": "",
  "phone": "",
  "address": "",
  "products": [
    {
      "productName": "",
      "quantity": 0,
      "color": "",
      "price": 0
    }
  ],
  "note": ""
}

RULES:
1. "customerName": Name of the buyer or recipient. Empty string if not mentioned.
2. "phone": 11-digit Bangladeshi mobile number starting with 01 (e.g. "017XXXXXXXX"). Convert any Bengali digits to English digits. Empty string if not mentioned.
3. "address": Full delivery address (District, Thana/Upazila, Area, Street, House).
4. "products": An array of one or more products ordered.
   - "productName": Name of the product or item.
   - "quantity": Integer number of pieces/units (e.g. 1, 2, 5). Default to 1 if not specified.
   - "color": Color (e.g. "Blue", "নীল", "Red"). Empty string if not mentioned.
   - "price": Numeric price or COD amount in BDT (e.g. 500, 1200). If total order price is mentioned on the message and items do not have individual prices, put the total on the main item or divide reasonably. Must be numeric integer.
5. "note": Special customer instructions, delivery preferences or courier notes.
6. NEVER invent or hallucinate information not in the message.
7. Return ONLY valid JSON adhering to the specified schema. No markdown outside JSON.`;

/**
 * Extract order using OpenRouter if credentials configured
 */
async function extractWithOpenRouter(
  text: string,
  apiKey: string,
  modelName: string
): Promise<ExtractedOrderData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aistudio.google.com',
        'X-Title': 'Order Management App',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName || 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_EXTRACTION_PROMPT },
          {
            role: 'user',
            content: `Extract order details from this message:\n\n"""\n${text}\n"""`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`OpenRouter API error (HTTP ${response.status}):`, errBody);
      return null;
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    return sanitizeAndValidateExtractedJSON(content);
  } catch (err: any) {
    console.warn('OpenRouter extraction failed:', err.message || err);
    return null;
  }
}

/**
 * Extract order using Gemini API
 */
async function extractWithGemini(text: string): Promise<ExtractedOrderData | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Extract order details from this message:\n\n"""\n${text}\n"""`,
      config: {
        systemInstruction: SYSTEM_EXTRACTION_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING },
            phone: { type: Type.STRING },
            address: { type: Type.STRING },
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  quantity: { type: Type.INTEGER },
                  color: { type: Type.STRING },
                  price: { type: Type.INTEGER },
                },
                required: ['productName', 'quantity', 'color', 'price'],
              },
            },
            note: { type: Type.STRING },
          },
          required: ['customerName', 'phone', 'address', 'products', 'note'],
        },
      },
    });

    const resText = response.text;
    if (!resText) return null;
    return sanitizeAndValidateExtractedJSON(resText);
  } catch (err: any) {
    console.warn('Gemini extraction failed:', err.message || err);
    return null;
  }
}

/**
 * Validates and sanitizes the parsed JSON
 */
export function sanitizeAndValidateExtractedJSON(rawJsonStringOrObj: any): ExtractedOrderData {
  let parsed: any;
  if (typeof rawJsonStringOrObj === 'string') {
    // Strip possible markdown fences
    const clean = rawJsonStringOrObj
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Try to find first { and last }
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        parsed = JSON.parse(clean.substring(start, end + 1));
      } else {
        throw new Error('Invalid JSON format received from AI model');
      }
    }
  } else {
    parsed = rawJsonStringOrObj;
  }

  // Sanitize customer name
  const customerName = String(parsed.customerName || '').trim();

  // Sanitize phone number (Bengali digits to English, exactly 11 digits starting with 01 if possible)
  let phone = convertBengaliDigits(String(parsed.phone || ''))
    .replace(/[^0-9]/g, '')
    .trim();
  if (phone.startsWith('8801')) {
    phone = phone.slice(2);
  } else if (phone.length > 11 && phone.startsWith('88')) {
    phone = phone.replace(/^88/, '');
  }

  // Sanitize address
  const address = String(parsed.address || '').trim();

  // Sanitize note
  const note = String(parsed.note || '').trim();

  // Sanitize products
  const products: ExtractedProductItem[] = [];
  if (Array.isArray(parsed.products) && parsed.products.length > 0) {
    for (const item of parsed.products) {
      if (!item) continue;
      const pName = String(item.productName || item.product || '').trim();
      const pColor = String(item.color || '').trim();
      const pQtyRaw = convertBengaliDigits(String(item.quantity ?? 1)).replace(/[^0-9]/g, '');
      const pQty = Math.max(1, parseInt(pQtyRaw, 10) || 1);
      const pPriceRaw = convertBengaliDigits(String(item.price ?? 0)).replace(/[^0-9]/g, '');
      const pPrice = Math.max(0, parseInt(pPriceRaw, 10) || 0);

      if (pName || pPrice > 0 || pColor) {
        products.push({
          productName: pName,
          quantity: pQty,
          color: pColor,
          price: pPrice,
        });
      }
    }
  }

  // If no products parsed, fallback to single item from legacy fields if any
  if (products.length === 0) {
    const legacyProd = String(parsed.product || '').trim();
    const legacyQtyRaw = convertBengaliDigits(String(parsed.quantity ?? 1)).replace(/[^0-9]/g, '');
    const legacyQty = Math.max(1, parseInt(legacyQtyRaw, 10) || 1);
    const legacyPriceRaw = convertBengaliDigits(String(parsed.price ?? 0)).replace(/[^0-9]/g, '');
    const legacyPrice = Math.max(0, parseInt(legacyPriceRaw, 10) || 0);
    const legacyColor = String(parsed.color || '').trim();

    products.push({
      productName: legacyProd,
      quantity: legacyQty,
      color: legacyColor,
      price: legacyPrice,
    });
  }

  // Computed summary fields for convenience
  const summaryProduct = products
    .map((p) => `${p.productName}${p.quantity > 1 ? ` (${p.quantity} pcs)` : ''}`)
    .filter(Boolean)
    .join(', ');
  const totalQty = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
  const summaryColor = products.map((p) => p.color).filter(Boolean).join(', ');

  return {
    customerName,
    phone,
    address,
    products,
    note,
    product: summaryProduct,
    quantity: String(totalQty),
    color: summaryColor,
    price: String(totalPrice),
  };
}

/**
 * Resilient regex/heuristic extractor for Bengali, Banglish & English messages
 * Supports multi-products, labels, and unlabeled lines
 */
export function fallbackExtract(text: string): ExtractedOrderData {
  const normalized = convertBengaliDigits(text || '');
  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let phone = '';
  const phoneMatch = normalized.match(/(?:\+?8801|01)[3-9]\d{8}/);
  if (phoneMatch) {
    phone = phoneMatch[0].replace('+88', '');
  }

  let customerName = '';
  let address = '';
  let note = '';
  const items: ExtractedProductItem[] = [];

  let currentItem: Partial<ExtractedProductItem> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // Customer Name
    if (/^(?:name|customer|নাম|গ্রাহক|ক্রেতা)[:\s]/i.test(trimmed)) {
      customerName = trimmed.replace(/^(?:name|customer|নাম|গ্রাহক|ক্রেতা)[:\s]*/i, '').trim();
      continue;
    }

    // Phone
    if (/^(?:phone|mobile|cell|ফোন|নাম্বার|মোবাইল)[:\s]/i.test(trimmed)) {
      const pm = trimmed.match(/(?:\+?8801|01)[3-9]\d{8}/);
      if (pm) phone = pm[0].replace('+88', '');
      continue;
    }

    // Address
    if (/^(?:address|location|ঠিকানা|বাসা)[:\s]/i.test(trimmed)) {
      address = trimmed.replace(/^(?:address|location|ঠিকানা|বাসা)[:\s]*/i, '').trim();
      continue;
    }

    // Note / Instructions
    if (/^(?:note|instruction|নোট|মন্তব্য|ডেলিভারি)[:\s]/i.test(trimmed)) {
      note = trimmed.replace(/^(?:note|instruction|নোট|মন্তব্য|ডেলিভারি)[:\s]*/i, '').trim();
      continue;
    }

    // Product line detection
    const productMatch = trimmed.match(/^(?:product|item|পণ্য|প্রোডাক্ট|আইটেম)[:\s]*(.+)/i);
    const hasPcsOrQty = /(?:পিস|জোড়া|pcs|pc|qty|পরিমাণ|\b\d+\s*টি\b)/i.test(trimmed);
    const hasPrice = /(?:tk|taka|টাকা|মূল্য|দাম|cod|\b\d{3,5}\b)/i.test(trimmed);

    if (productMatch) {
      if (currentItem.productName) {
        items.push({
          productName: currentItem.productName || 'Product',
          quantity: currentItem.quantity || 1,
          color: currentItem.color || '',
          price: currentItem.price || 0,
        });
        currentItem = {};
      }
      currentItem.productName = productMatch[1].trim();
    } else if (hasPcsOrQty || hasPrice || /(?:কালার|রং|color)/i.test(trimmed)) {
      // Analyze current line for quantity, color, price
      const qtyMatch = trimmed.match(/(\d+)\s*(?:pcs|pc|টি|পিস|জোড়া)/i) ||
        trimmed.match(/(?:qty|quantity|পরিমাণ|সংখ্যা)[:\s]*(\d+)/i);
      if (qtyMatch) {
        currentItem.quantity = parseInt(qtyMatch[1], 10);
      }

      const priceMatch = trimmed.match(/(?:price|দাম|টাকা|মূল্য|tk|taka|cod)[:\s]*(\d+)/i) ||
        trimmed.match(/(\d{3,5})\s*(?:tk|taka|টাকা)/i);
      if (priceMatch) {
        currentItem.price = parseInt(priceMatch[1], 10);
      }

      const colorMatch = trimmed.match(/(?:color|colour|কালার|রং|রঙ)[:\s]*([^\d,\n]+)/i);
      if (colorMatch) {
        currentItem.color = colorMatch[1].trim();
      }

      // If line contains item name before pcs/price
      if (!currentItem.productName && !trimmed.includes('01') && !trimmed.toLowerCase().includes('name')) {
        const cleaned = trimmed
          .replace(/(\d+)\s*(?:pcs|pc|টি|পিস|জোড়া)/gi, '')
          .replace(/(?:tk|taka|টাকা|মূল্য|দাম)[:\s]*\d+/gi, '')
          .replace(/\b\d{3,5}\b/g, '')
          .replace(/(?:color|colour|কালার|রং|রঙ)[:\s]*[^\s]+/gi, '')
          .trim();
        if (cleaned.length > 2) {
          currentItem.productName = cleaned;
        }
      }
    } else if (!customerName && lines.indexOf(line) === 0 && !line.includes('01') && line.length < 35) {
      customerName = trimmed;
    } else if (!address && (trimmed.includes('ঢাকা') || trimmed.includes('চট্টগ্রাম') || trimmed.includes('গাজীপুর') || trimmed.includes('রোড') || trimmed.includes('বাসা') || trimmed.includes('থানা'))) {
      address = trimmed;
    } else if (!currentItem.productName && trimmed.length > 2 && !trimmed.includes('01')) {
      currentItem.productName = trimmed;
    }
  }

  if (currentItem.productName || currentItem.price || currentItem.quantity) {
    items.push({
      productName: currentItem.productName || 'Product',
      quantity: currentItem.quantity || 1,
      color: currentItem.color || '',
      price: currentItem.price || 0,
    });
  }

  if (items.length === 0) {
    items.push({
      productName: '',
      quantity: 1,
      color: '',
      price: 0,
    });
  }

  const summaryProduct = items
    .map((p) => `${p.productName}${p.quantity > 1 ? ` (${p.quantity} pcs)` : ''}`)
    .filter(Boolean)
    .join(', ');
  const totalQty = items.reduce((sum, p) => sum + p.quantity, 0);
  const totalPrice = items.reduce((sum, p) => sum + p.price, 0);
  const summaryColor = items.map((p) => p.color).filter(Boolean).join(', ');

  return {
    customerName,
    phone,
    address,
    products: items,
    note,
    product: summaryProduct,
    quantity: String(totalQty),
    color: summaryColor,
    price: String(totalPrice),
  };
}

/**
 * Main Order Processing Engine
 * Priority:
 * 1. OpenRouter (if OPENROUTER_API_KEY is configured)
 * 2. Gemini API (if GEMINI_API_KEY is configured)
 * 3. Resilient Fallback Heuristic Parser
 */
export async function processCustomerOrderText(rawText: string): Promise<ExtractedOrderData> {
  const cleanInput = convertBengaliDigits(rawText || '').trim();
  if (!cleanInput) {
    return {
      customerName: '',
      phone: '',
      address: '',
      products: [{ productName: '', quantity: 1, color: '', price: 0 }],
      note: '',
    };
  }

  // 1. Check OpenRouter
  const openRouterConfig = db.getOpenRouterConfig();
  if (openRouterConfig.apiKey) {
    console.log(`Extracting order with OpenRouter (model: ${openRouterConfig.model})...`);
    const openRouterResult = await extractWithOpenRouter(
      rawText,
      openRouterConfig.apiKey,
      openRouterConfig.model
    );
    if (openRouterResult) {
      return openRouterResult;
    }
    console.warn('OpenRouter extraction did not succeed, attempting fallback...');
  }

  // 2. Check Gemini
  if (process.env.GEMINI_API_KEY) {
    console.log('Extracting order with Gemini API...');
    const geminiResult = await extractWithGemini(rawText);
    if (geminiResult) {
      return geminiResult;
    }
    console.warn('Gemini extraction did not succeed, attempting fallback parser...');
  }

  // 3. Fallback parser
  console.log('Using resilient heuristic fallback extractor...');
  return fallbackExtract(rawText);
}
