using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MasaPilot.Application.Common;
using MasaPilot.Domain.Entities;
using MasaPilot.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MasaPilot.Infrastructure.Data;

public static class GalipUstaSeeder
{
    public static async Task SeedAllAsync(MasaPilotDbContext db, IPasswordHasher hasher)
    {
        // 1. Ensure Default Tenant, Branch & Admin User
        var adminUser = await db.Users.FirstOrDefaultAsync(u => u.Email == "yonetici@masapilot.com");
        if (adminUser == null)
        {
            var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Slug == "galip-usta");
            if (tenant == null)
            {
                tenant = new Tenant
                {
                    Name = "Galip Usta Pide Salonu",
                    Slug = "galip-usta",
                    TaxNumber = "1234567890",
                    IsActive = true
                };
                db.Tenants.Add(tenant);
                await db.SaveChangesAsync();
            }

            var branch = await db.Branches.FirstOrDefaultAsync(b => b.TenantId == tenant.Id && b.Name == "Merkez Şube");
            if (branch == null)
            {
                branch = new Branch
                {
                    TenantId = tenant.Id,
                    Name = "Merkez Şube",
                    CurrencyCode = "TRY",
                    TimeZone = "Europe/Istanbul",
                    IsActive = true
                };
                db.Branches.Add(branch);
                await db.SaveChangesAsync();
            }

            adminUser = new User
            {
                TenantId = tenant.Id,
                DefaultBranchId = branch.Id,
                FullName = "Galip Usta Yönetici",
                Email = "yonetici@masapilot.com",
                PasswordHash = hasher.HashPassword("Password123!"),
                PinCodeHash = hasher.HashPin("1234"),
                Role = UserRole.TenantOwner,
                IsActive = true
            };
            db.Users.Add(adminUser);

            // Kitchen & Bar Stations
            var kitchen = new KitchenStation { TenantId = tenant.Id, BranchId = branch.Id, Name = "Mutfak", IsActive = true };
            var bar = new KitchenStation { TenantId = tenant.Id, BranchId = branch.Id, Name = "Bar", IsActive = true };
            db.KitchenStations.AddRange(kitchen, bar);

            // Printers (Virtual / Network)
            var kitchenPrinter = new Printer
            {
                TenantId = tenant.Id,
                BranchId = branch.Id,
                Name = "Mutfak Termal Yazıcı",
                ConnectionType = PrinterConnectionType.VirtualFake,
                KitchenStationId = kitchen.Id,
                PaperWidth = "80mm",
                IsActive = true
            };
            var barPrinter = new Printer
            {
                TenantId = tenant.Id,
                BranchId = branch.Id,
                Name = "Bar Termal Yazıcı",
                ConnectionType = PrinterConnectionType.VirtualFake,
                KitchenStationId = bar.Id,
                PaperWidth = "80mm",
                IsActive = true
            };
            db.Printers.AddRange(kitchenPrinter, barPrinter);

            // Areas & Tables
            var areaSalon = new AreaFloor { TenantId = tenant.Id, BranchId = branch.Id, Name = "Salon", DisplayOrder = 1 };
            var areaBahce = new AreaFloor { TenantId = tenant.Id, BranchId = branch.Id, Name = "Bahçe", DisplayOrder = 2 };
            db.AreaFloors.AddRange(areaSalon, areaBahce);
            await db.SaveChangesAsync();

            for (int i = 1; i <= 8; i++)
            {
                db.DiningTables.Add(new DiningTable
                {
                    TenantId = tenant.Id,
                    BranchId = branch.Id,
                    AreaFloorId = areaSalon.Id,
                    TableNumber = $"S{i}",
                    Capacity = 4,
                    DisplayOrder = i,
                    Status = TableStatus.Empty
                });
            }

            for (int i = 1; i <= 6; i++)
            {
                db.DiningTables.Add(new DiningTable
                {
                    TenantId = tenant.Id,
                    BranchId = branch.Id,
                    AreaFloorId = areaBahce.Id,
                    TableNumber = $"B{i}",
                    Capacity = 4,
                    DisplayOrder = i,
                    Status = TableStatus.Empty
                });
            }

            // Payment Methods
            db.PaymentMethods.AddRange(
                new PaymentMethod { TenantId = tenant.Id, BranchId = branch.Id, Name = "Nakit", Type = PaymentType.Cash, IsActive = true },
                new PaymentMethod { TenantId = tenant.Id, BranchId = branch.Id, Name = "Kredi / Banka Kartı", Type = PaymentType.CardExternalTerminal, IsActive = true },
                new PaymentMethod { TenantId = tenant.Id, BranchId = branch.Id, Name = "Yemek Kartı (Sodexo / Multinet)", Type = PaymentType.MealVoucher, IsActive = true }
            );

            // Note Templates
            db.NoteTemplates.AddRange(
                new NoteTemplate { TenantId = tenant.Id, BranchId = branch.Id, Title = "Az Pişmiş", Content = "Az Pişmiş (Rare)", DisplayOrder = 1, IsActive = true },
                new NoteTemplate { TenantId = tenant.Id, BranchId = branch.Id, Title = "Orta Pişmiş", Content = "Orta Pişmiş (Medium)", DisplayOrder = 2, IsActive = true },
                new NoteTemplate { TenantId = tenant.Id, BranchId = branch.Id, Title = "İyi Pişmiş", Content = "İyi Pişmiş (Well Done)", DisplayOrder = 3, IsActive = true },
                new NoteTemplate { TenantId = tenant.Id, BranchId = branch.Id, Title = "Buzsuz", Content = "İçecek Buzsuz Olsun", DisplayOrder = 4, IsActive = true },
                new NoteTemplate { TenantId = tenant.Id, BranchId = branch.Id, Title = "Acısız", Content = "Lütfen Acısız Hazırlansın", DisplayOrder = 5, IsActive = true },
                new NoteTemplate { TenantId = tenant.Id, BranchId = branch.Id, Title = "Alerjen Uyarısı", Content = "DİKKAT: Alerjen Hassasiyeti Var", DisplayOrder = 6, IsActive = true }
            );

            await db.SaveChangesAsync();
        }

        // 2. Seed Full Menu
        await SeedMenuAsync(db);
    }

    public static async Task SeedMenuAsync(MasaPilotDbContext db)
    {
        var branches = await db.Branches.ToListAsync();
        if (!branches.Any()) return;

        foreach (var branch in branches)
        {
            var kitchen = await db.KitchenStations.FirstOrDefaultAsync(s => s.BranchId == branch.Id && s.Name == "Mutfak");
            var bar = await db.KitchenStations.FirstOrDefaultAsync(s => s.BranchId == branch.Id && s.Name == "Bar");

            // Deactivate any old generic test categories
            var oldCategories = await db.Categories
                .Where(c => c.BranchId == branch.Id && (c.Name == "Sıcak İçecekler" || c.Name == "Soğuk İçecekler" || c.Name == "Ana Yemekler"))
                .ToListAsync();
            foreach (var old in oldCategories)
            {
                old.IsActive = false;
            }

            // Standardize table numbers (e.g. S-1 -> S1, B-1 -> B1)
            var branchTables = await db.DiningTables.Where(t => t.BranchId == branch.Id).ToListAsync();
            foreach (var t in branchTables)
            {
                if (t.TableNumber.Contains('-'))
                {
                    t.TableNumber = t.TableNumber.Replace("-", "");
                }
            }

            // 1. Açık Pideler
            var catAcik = await GetOrCreateCategory(db, branch, "Açık Pideler", 1, "#7C1C1D");
            await EnsureProducts(db, branch, catAcik.Id, kitchen?.Id, new (string Name, decimal Price)[]
            {
                ("Kuşbaşılı", 370m),
                ("Kıymalı", 370m),
                ("Kavurmalı", 400m),
                ("Kavurmalı Kaşarlı", 430m),
                ("Pastırmalı", 400m),
                ("Kuşbaşı Kaşarlı", 380m),
                ("Kıymalı Kaşarlı", 380m),
                ("Pastırmalı Kaşarlı", 430m),
                ("Kaşarlı", 350m),
                ("Dört Mevsim", 430m),
                ("Beyaz Peynirli", 350m),
                ("Kaşarlı Beyaz Peynirli", 370m),
                ("Karışık", 400m),
                ("Sucuklu Kaşarlı", 380m),
                ("Sucuklu", 370m),
                ("Çökelekli", 320m),
                ("Yağlı Yumurtalı", 250m),
                ("Sebzeli", 300m)
            });

            // 2. Kapalı Pideler
            var catKapali = await GetOrCreateCategory(db, branch, "Kapalı Pideler", 2, "#991B1B");
            await EnsureProducts(db, branch, catKapali.Id, kitchen?.Id, new (string Name, decimal Price)[]
            {
                ("Kıymalı", 250m),
                ("Kaşarlı", 220m),
                ("Kavurmalı", 280m),
                ("Kavurmalı Kaşarlı", 300m),
                ("Beyaz Peynirli", 220m),
                ("Sucuklu Kaşarlı", 260m),
                ("Pastırmalı Kaşarlı", 300m),
                ("Kıymalı Kaşarlı", 260m),
                ("Kaşarlı Beyaz Peynirli", 240m),
                ("Çökelekli", 220m),
                ("Patatesli", 220m),
                ("Ispanaklı", 220m),
                ("Mantarlı", 240m),
                ("Mantarlı Kaşarlı", 260m)
            });

            // 3. Kahvaltılar (Güne Başlarken)
            var catKahvalti = await GetOrCreateCategory(db, branch, "Kahvaltılar", 3, "#D97706");
            await EnsureProducts(db, branch, catKahvalti.Id, kitchen?.Id, new (string Name, decimal Price)[]
            {
                ("Serpme Kahvaltı (Tek Kişilik)", 1000m),
                ("Serpme Kahvaltı (İki Kişilik)", 1800m)
            });

            // 4. Tatlılar
            var catTatli = await GetOrCreateCategory(db, branch, "Tatlılar", 4, "#7C2D12");
            await EnsureProducts(db, branch, catTatli.Id, kitchen?.Id, new (string Name, decimal Price)[]
            {
                ("Sütlaç", 150m),
                ("Kare Katmer", 300m)
            });

            // 5. İçecekler
            var catIcecek = await GetOrCreateCategory(db, branch, "İçecekler", 5, "#1E3A8A");
            await EnsureProducts(db, branch, catIcecek.Id, bar?.Id, new (string Name, decimal Price)[]
            {
                ("Cola", 70m),
                ("Fanta", 70m),
                ("Sprite", 70m),
                ("Meyve Suyu", 70m),
                ("Şalgam", 50m),
                ("Soda", 50m),
                ("Açık Ayran", 50m),
                ("Kapalı Ayran", 50m),
                ("Su", 20m)
            });
        }

        await db.SaveChangesAsync();
    }

    private static async Task<Category> GetOrCreateCategory(MasaPilotDbContext db, Branch branch, string name, int displayOrder, string colorHex)
    {
        var cat = await db.Categories.FirstOrDefaultAsync(c => c.BranchId == branch.Id && c.Name == name);
        if (cat == null)
        {
            cat = new Category
            {
                TenantId = branch.TenantId,
                BranchId = branch.Id,
                Name = name,
                DisplayOrder = displayOrder,
                ColorHex = colorHex,
                IsActive = true
            };
            db.Categories.Add(cat);
            await db.SaveChangesAsync();
        }
        else
        {
            cat.IsActive = true;
            cat.DisplayOrder = displayOrder;
            cat.ColorHex = colorHex;
        }
        return cat;
    }

    private static async Task EnsureProducts(MasaPilotDbContext db, Branch branch, Guid categoryId, Guid? stationId, IEnumerable<(string Name, decimal Price)> items)
    {
        foreach (var item in items)
        {
            var prod = await db.Products.FirstOrDefaultAsync(p => p.CategoryId == categoryId && p.Name == item.Name && p.BranchId == branch.Id);
            if (prod == null)
            {
                prod = new Product
                {
                    TenantId = branch.TenantId,
                    BranchId = branch.Id,
                    CategoryId = categoryId,
                    Name = item.Name,
                    Description = item.Name,
                    UnitPrice = item.Price,
                    VatRate = 10m,
                    IsActive = true,
                    IsAvailable = true
                };

                if (stationId.HasValue)
                {
                    prod.StationRoutes.Add(new ProductStationRoute
                    {
                        TenantId = branch.TenantId,
                        BranchId = branch.Id,
                        KitchenStationId = stationId.Value
                    });
                }

                db.Products.Add(prod);
            }
            else
            {
                prod.UnitPrice = item.Price;
                prod.IsActive = true;
                prod.IsAvailable = true;
            }
        }
    }
}
