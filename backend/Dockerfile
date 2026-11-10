# Multi-stage Dockerfile for ASP.NET Core 8 Web API
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project definitions for efficient Docker layer caching
COPY ["SchoolAdmission.sln", "./"]
COPY ["SchoolAdmission.Api/SchoolAdmission.Api.csproj", "SchoolAdmission.Api/"]
COPY ["SchoolAdmission.Tests/SchoolAdmission.Tests.csproj", "SchoolAdmission.Tests/"]

# Restore NuGet dependencies
RUN dotnet restore "SchoolAdmission.sln"

# Copy remaining source code
COPY . .

# Run automated tests during Docker build to enforce verification
RUN dotnet test "SchoolAdmission.Tests/SchoolAdmission.Tests.csproj" -c Release --no-restore --logger "console;verbosity=normal"

# Publish the API project
WORKDIR "/src/SchoolAdmission.Api"
RUN dotnet publish "SchoolAdmission.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime Image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]

