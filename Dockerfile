# 1. Base Runtime Image (.NET 9 ASP.NET Core)
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV RuntimeMode=Edge

# 2. Build Image (.NET 9 SDK + Node.js for Vite React build)
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Node.js 20 kur (Vite derlemesi için)
RUN apt-get update && apt-get install -y curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Kaynak kodları kopyala
COPY . .

# Frontend'i (React + Vite) derle ve wwwroot'a bas
WORKDIR /src/src/MasaPilot.Web
RUN npm install
RUN npm run build

# Backend .NET uygulamasını derle
WORKDIR /src
RUN dotnet restore src/MasaPilot.Api/MasaPilot.Api.csproj
RUN dotnet publish src/MasaPilot.Api/MasaPilot.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# 3. Final Production Container
FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .

# SQLite veri klasörünü ve upload dizinini hazırla
RUN mkdir -p /app/data /app/uploads
VOLUME ["/app/data", "/app/uploads"]

ENTRYPOINT ["dotnet", "MasaPilot.Api.dll"]
