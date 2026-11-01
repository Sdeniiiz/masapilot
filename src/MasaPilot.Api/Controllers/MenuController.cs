using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using MasaPilot.Application.Common;
using MasaPilot.Application.DTOs;
using MasaPilot.Domain.Entities;
using MasaPilot.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MasaPilot.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1")]
public class MenuController : ControllerBase
{
    private readonly MasaPilotDbContext _db;
    private readonly ICurrentTenantService _tenantService;
    private readonly IWebHostEnvironment _env;

    public MenuController(MasaPilotDbContext db, ICurrentTenantService tenantService, IWebHostEnvironment env)
    {
        _db = db;
        _tenantService = tenantService;
        _env = env;
    }

    [HttpGet("categories")]
    public async Task<ActionResult<List<CategoryDto>>> GetCategories()
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var categories = await _db.Categories
            .Where(c => c.TenantId == tenantId.Value && c.BranchId == branchId.Value && c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .Select(c => new CategoryDto(
                c.Id,
                c.Name,
                c.DisplayOrder,
                c.ColorHex,
                c.IsActive,
                c.Products.Count(p => p.IsActive)
            ))
            .ToListAsync();

        return Ok(categories);
    }

    [HttpPost("categories")]
    public async Task<ActionResult<CategoryDto>> CreateCategory([FromBody] CreateCategoryRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var category = new Category
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            Name = request.Name,
            DisplayOrder = request.DisplayOrder,
            ColorHex = request.ColorHex
        };

        _db.Categories.Add(category);
        await _db.SaveChangesAsync();

        return Ok(new CategoryDto(category.Id, category.Name, category.DisplayOrder, category.ColorHex, category.IsActive, 0));
    }

    [HttpGet("products")]
    public async Task<ActionResult<List<ProductDto>>> GetProducts([FromQuery] Guid? categoryId)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var query = _db.Products
            .Include(p => p.Category)
            .Include(p => p.StationRoutes)
            .Where(p => p.TenantId == tenantId.Value && p.BranchId == branchId.Value && p.IsActive);

        if (categoryId.HasValue)
        {
            query = query.Where(p => p.CategoryId == categoryId.Value);
        }

        var products = await query.ToListAsync();

        var result = products.Select(p => new ProductDto(
            p.Id,
            p.CategoryId,
            p.Category?.Name ?? "",
            p.Name,
            p.Description,
            p.Sku,
            p.Barcode,
            p.UnitPrice,
            p.VatRate,
            p.ImageUrl,
            p.IsActive,
            p.IsAvailable,
            p.StationRoutes.Select(r => r.KitchenStationId).ToList()
        )).ToList();

        return Ok(result);
    }

    [HttpPost("products")]
    public async Task<ActionResult<ProductDto>> CreateProduct([FromBody] CreateProductRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId && c.TenantId == tenantId.Value);
        if (category == null) return NotFound("Kategori bulunamadı.");

        var product = new Product
        {
            TenantId = tenantId.Value,
            BranchId = branchId.Value,
            CategoryId = request.CategoryId,
            Name = request.Name,
            Description = request.Description,
            UnitPrice = request.UnitPrice,
            VatRate = request.VatRate,
            Sku = request.Sku,
            Barcode = request.Barcode,
            ImageUrl = request.ImageUrl,
            IsActive = true,
            IsAvailable = true
        };

        if (request.StationRouteIds != null)
        {
            foreach (var sId in request.StationRouteIds)
            {
                product.StationRoutes.Add(new ProductStationRoute
                {
                    TenantId = tenantId.Value,
                    BranchId = branchId.Value,
                    KitchenStationId = sId
                });
            }
        }

        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        return Ok(new ProductDto(
            product.Id,
            product.CategoryId,
            category.Name,
            product.Name,
            product.Description,
            product.Sku,
            product.Barcode,
            product.UnitPrice,
            product.VatRate,
            product.ImageUrl,
            product.IsActive,
            product.IsAvailable,
            product.StationRoutes.Select(r => r.KitchenStationId).ToList()
        ));
    }

    [HttpPut("products/{id}")]
    public async Task<ActionResult<ProductDto>> UpdateProduct(Guid id, [FromBody] UpdateProductRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var product = await _db.Products
            .Include(p => p.StationRoutes)
            .Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId.Value);

        if (product == null) return NotFound();

        product.CategoryId = request.CategoryId;
        product.Name = request.Name;
        product.Description = request.Description;
        product.UnitPrice = request.UnitPrice;
        product.VatRate = request.VatRate;
        product.IsActive = request.IsActive;
        product.IsAvailable = request.IsAvailable;
        product.Sku = request.Sku;
        product.Barcode = request.Barcode;
        if (!string.IsNullOrEmpty(request.ImageUrl)) product.ImageUrl = request.ImageUrl;

        // Update station routes
        _db.ProductStationRoutes.RemoveRange(product.StationRoutes);
        if (request.StationRouteIds != null)
        {
            foreach (var sId in request.StationRouteIds)
            {
                _db.ProductStationRoutes.Add(new ProductStationRoute
                {
                    TenantId = tenantId.Value,
                    BranchId = branchId.Value,
                    ProductId = product.Id,
                    KitchenStationId = sId
                });
            }
        }

        await _db.SaveChangesAsync();

        var cat = await _db.Categories.FindAsync(product.CategoryId);
        return Ok(new ProductDto(
            product.Id,
            product.CategoryId,
            cat?.Name ?? "",
            product.Name,
            product.Description,
            product.Sku,
            product.Barcode,
            product.UnitPrice,
            product.VatRate,
            product.ImageUrl,
            product.IsActive,
            product.IsAvailable,
            request.StationRouteIds ?? new List<Guid>()
        ));
    }

    [HttpPost("products/upload-image")]
    public async Task<IActionResult> UploadProductImage(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("Dosya seçilmedi.");

        if (file.Length > 5 * 1024 * 1024) // 5MB limit
        {
            return BadRequest("Görsel boyutu en fazla 5MB olabilir.");
        }

        // Validate Magic Bytes
        using var stream = file.OpenReadStream();
        byte[] header = new byte[8];
        await stream.ReadExactlyAsync(header, 0, 8);

        bool isJpg = header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
        bool isPng = header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;
        bool isWebp = header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46; // RIFF....WEBP

        if (!isJpg && !isPng && !isWebp)
        {
            return BadRequest("Yalnızca geçerli JPG, PNG veya WebP formatları yüklenebilir.");
        }

        var ext = isJpg ? ".jpg" : (isPng ? ".png" : ".webp");
        var fileName = $"{Guid.NewGuid()}{ext}";
        var uploadDir = Path.Combine(_env.ContentRootPath, "uploads", "products");
        Directory.CreateDirectory(uploadDir);
        var fullPath = Path.Combine(uploadDir, fileName);

        stream.Position = 0;
        using (var dest = System.IO.File.Create(fullPath))
        {
            await stream.CopyToAsync(dest);
        }

        var relativeUrl = $"/uploads/products/{fileName}";
        return Ok(new { url = relativeUrl });
    }

    [HttpPut("categories/{id}")]
    public async Task<ActionResult<CategoryDto>> UpdateCategory(Guid id, [FromBody] CreateCategoryRequest request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId.Value);
        if (cat == null) return NotFound();

        cat.Name = request.Name;
        cat.DisplayOrder = request.DisplayOrder;
        cat.ColorHex = request.ColorHex;
        await _db.SaveChangesAsync();

        return Ok(new CategoryDto(cat.Id, cat.Name, cat.DisplayOrder, cat.ColorHex, cat.IsActive, 0));
    }

    [HttpDelete("categories/{id}")]
    public async Task<IActionResult> DeleteCategory(Guid id)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue) return BadRequest();

        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId.Value);
        if (cat == null) return NotFound();

        cat.IsActive = false; // soft delete
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("products/{id}")]
    public async Task<IActionResult> DeleteProduct(Guid id)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue) return BadRequest();

        var prod = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId.Value);
        if (prod == null) return NotFound();

        prod.IsActive = false; // soft delete
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("note-templates")]
    public async Task<ActionResult<List<NoteTemplate>>> GetNoteTemplates()
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        var templates = await _db.NoteTemplates
            .Where(n => n.TenantId == tenantId.Value && n.BranchId == branchId.Value && n.IsActive)
            .OrderBy(n => n.DisplayOrder)
            .ToListAsync();

        return Ok(templates);
    }

    [HttpPost("note-templates")]
    public async Task<ActionResult<NoteTemplate>> CreateNoteTemplate([FromBody] NoteTemplate request)
    {
        var tenantId = _tenantService.TenantId;
        var branchId = _tenantService.BranchId;
        if (!tenantId.HasValue || !branchId.HasValue) return BadRequest();

        request.TenantId = tenantId.Value;
        request.BranchId = branchId.Value;
        request.IsActive = true;

        _db.NoteTemplates.Add(request);
        await _db.SaveChangesAsync();

        return Ok(request);
    }

    [HttpDelete("note-templates/{id}")]
    public async Task<IActionResult> DeleteNoteTemplate(Guid id)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue) return BadRequest();

        var template = await _db.NoteTemplates.FirstOrDefaultAsync(n => n.Id == id && n.TenantId == tenantId.Value);
        if (template == null) return NotFound();

        template.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
