using System.Security.Cryptography;

namespace SchoolAdmission.Api.Common;

public static class IdGenerator
{
    private static readonly char[] Characters = "0123456789abcdefghijklmnopqrstuvwxyz".ToCharArray();

    public static string GenerateClassId()
    {
        return $"c_{GenerateRandomString(10)}";
    }

    public static string GenerateHoldId()
    {
        return $"h_{GenerateRandomString(12)}";
    }

    private static string GenerateRandomString(int length)
    {
        var bytes = RandomNumberGenerator.GetBytes(length);
        var result = new char[length];
        for (int i = 0; i < length; i++)
        {
            result[i] = Characters[bytes[i] % Characters.Length];
        }
        return new string(result);
    }
}

