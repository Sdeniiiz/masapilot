using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MasaPilot.Api.Controllers;

public record NetworkInfoDto(
    string PrimaryIp,
    List<string> AllLocalIps,
    int Port,
    string ServerUrl,
    string MachineName,
    DateTime ServerTimeUtc
);

[ApiController]
[Route("api/v1/system")]
public class SystemController : ControllerBase
{
    [HttpGet("network-info")]
    [AllowAnonymous] // Allows garson/client checking server connection freely
    public ActionResult<NetworkInfoDto> GetNetworkInfo()
    {
        var localIps = new List<string>();
        string primaryIp = "localhost";

        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                {
                    var ipStr = ip.ToString();
                    localIps.Add(ipStr);
                    // Prioritize 192.168.x.x or 10.x.x.x typical Wi-Fi router addresses
                    if (ipStr.StartsWith("192.168.") || (primaryIp == "localhost" && ipStr.StartsWith("10.")))
                    {
                        primaryIp = ipStr;
                    }
                }
            }

            if (primaryIp == "localhost" && localIps.Any())
            {
                primaryIp = localIps.First();
            }
        }
        catch
        {
            // Fallback to localhost if network discovery is restricted
        }

        int port = Request.Host.Port ?? 5000;
        string serverUrl = primaryIp != "localhost"
            ? $"http://{primaryIp}:{port}"
            : $"http://localhost:{port}";

        return Ok(new NetworkInfoDto(
            primaryIp,
            localIps,
            port,
            serverUrl,
            Environment.MachineName,
            DateTime.UtcNow
        ));
    }
}
