"""
Multimodal extraction from PDFs using PyMuPDF.
Extracts tables as markdown text chunks and images as OCR text chunks,
saving visual assets (table screenshots, image thumbnails) to disk
so the UI can display them in the "Why this answer?" panel.
"""

import os
import io
from pathlib import Path
from typing import List, Dict, Any
from PIL import Image

import fitz  # PyMuPDF


def extract_tables_and_images(
    pdf_path: str,
    assets_dir: str,
    source_file: str,
) -> List[Dict[str, Any]]:
    """
    Extract tables and images from a PDF file.

    Returns a list of dicts, each representing a multimodal chunk:
    {
        "text": str,          # text representation for embedding
        "page": int,          # 0-indexed page number
        "chunk_type": str,    # "table" | "figure"
        "asset_path": str,    # relative path to saved visual asset
        "source_file": str,
        "file_type": "pdf",
        "section": str,       # e.g. "Table 1 on Page 3"
    }
    """
    doc = fitz.open(pdf_path)
    os.makedirs(assets_dir, exist_ok=True)
    chunks: List[Dict[str, Any]] = []

    table_counter = 0
    figure_counter = 0

    for page_num in range(len(doc)):
        page = doc[page_num]

        # --- Extract Tables ---
        try:
            tables = page.find_tables()
            for table in tables:
                table_counter += 1
                # Convert table to markdown text for embedding
                markdown = _table_to_markdown(table)
                if not markdown or len(markdown.strip()) < 10:
                    continue

                # Save a screenshot of the table region as a PNG
                asset_filename = f"table_{page_num}_{table_counter}.png"
                asset_path = os.path.join(assets_dir, asset_filename)
                _save_table_screenshot(page, table.bbox, asset_path)

                chunks.append({
                    "text": f"[Table {table_counter}, Page {page_num + 1}]\n{markdown}",
                    "page": page_num,
                    "chunk_type": "table",
                    "asset_path": asset_filename,
                    "source_file": source_file,
                    "file_type": "pdf",
                    "section": f"Table {table_counter} on Page {page_num + 1}",
                })
        except Exception as e:
            print(f"[WARN] Table extraction failed on page {page_num}: {e}")

        # --- Extract Images ---
        try:
            image_list = page.get_images(full=True)
            for img_idx, img_info in enumerate(image_list):
                xref = img_info[0]
                figure_counter += 1

                # Extract the image bytes
                base_image = doc.extract_image(xref)
                if not base_image or not base_image.get("image"):
                    continue

                image_bytes = base_image["image"]
                image_ext = base_image.get("ext", "png")

                # Skip tiny images (likely icons/bullets)
                width = base_image.get("width", 0)
                height = base_image.get("height", 0)
                if width < 50 or height < 50:
                    continue

                # Save the image thumbnail
                asset_filename = f"figure_{page_num}_{figure_counter}.{image_ext}"
                asset_path = os.path.join(assets_dir, asset_filename)
                _save_image_thumbnail(image_bytes, asset_path)

                # Get OCR text from the image region
                ocr_text = _get_image_region_text(page, xref)

                # If no OCR text, generate a descriptive placeholder
                if not ocr_text or len(ocr_text.strip()) < 5:
                    ocr_text = f"Figure on page {page_num + 1} ({width}x{height} pixels)"

                chunks.append({
                    "text": f"[Figure {figure_counter}, Page {page_num + 1}]\n{ocr_text}",
                    "page": page_num,
                    "chunk_type": "figure",
                    "asset_path": asset_filename,
                    "source_file": source_file,
                    "file_type": "pdf",
                    "section": f"Figure {figure_counter} on Page {page_num + 1}",
                })
        except Exception as e:
            print(f"[WARN] Image extraction failed on page {page_num}: {e}")

    doc.close()
    print(f"[INFO] Extracted {table_counter} tables, {figure_counter} figures from {source_file}")
    return chunks


def _table_to_markdown(table) -> str:
    """Convert a PyMuPDF table object to a markdown-formatted string."""
    try:
        data = table.extract()
        if not data or len(data) == 0:
            return ""

        # Build markdown table
        lines = []
        for row_idx, row in enumerate(data):
            cells = [str(cell).strip() if cell else "" for cell in row]
            lines.append("| " + " | ".join(cells) + " |")
            if row_idx == 0:
                lines.append("| " + " | ".join(["---"] * len(cells)) + " |")

        return "\n".join(lines)
    except Exception:
        return ""


def _save_table_screenshot(page, bbox, output_path: str, scale: float = 2.0):
    """Render the table bounding box region as a PNG image."""
    try:
        rect = fitz.Rect(bbox)
        # Add some padding
        rect.x0 = max(0, rect.x0 - 5)
        rect.y0 = max(0, rect.y0 - 5)
        rect.x1 = min(page.rect.width, rect.x1 + 5)
        rect.y1 = min(page.rect.height, rect.y1 + 5)

        mat = fitz.Matrix(scale, scale)
        clip = rect
        pix = page.get_pixmap(matrix=mat, clip=clip)
        pix.save(output_path)
    except Exception as e:
        print(f"[WARN] Failed to save table screenshot: {e}")


def _save_image_thumbnail(image_bytes: bytes, output_path: str, max_size: int = 600):
    """Save image bytes as a thumbnail PNG."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.thumbnail((max_size, max_size), Image.LANCZOS)
        # Convert to RGB if needed (e.g., CMYK, P mode)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        img.save(output_path, "PNG")
    except Exception as e:
        print(f"[WARN] Failed to save image thumbnail: {e}")


def _get_image_region_text(page, xref: int) -> str:
    """
    Try to extract text from the region around an image.
    Falls back to nearby text blocks since the image itself
    may not contain selectable text.
    """
    try:
        # Get the bounding boxes of this image on the page
        rects = page.get_image_rects(xref)
        if not rects:
            return ""

        rect = rects[0]
        # Expand the rect slightly to capture nearby captions/labels
        expanded = fitz.Rect(
            rect.x0 - 10,
            rect.y0 - 30,
            rect.x1 + 10,
            rect.y1 + 40,
        )
        # Clip to page bounds
        expanded = expanded & page.rect

        text = page.get_textbox(expanded)
        return text.strip() if text else ""
    except Exception:
        return ""
