import UIKit

enum NativeTripColorBank {
    static func options() -> [NativeTripBackgroundOption] {
        [
            option("Sunrise", 0xE92CEB, 0xFF7043),
            option("Sunset", 0xFFC43D, 0xFF5A2A),
            option("Sea", 0x4268F5, 0x00D4E8),
            option("Island", 0xE8D70B, 0x2ED1A2),
            option("Desert", 0xFF9435, 0xFFD438),
            option("Snow", 0x10D9E7, 0x387AF5),
            option("Grove", 0xF4AE5D, 0xDDF000),
            option("Road", 0xC8B8B8, 0x57494B),
            option("Mountain", 0xB76E3C, 0x4778B5),
            option("Rooftop", 0xB72DE4, 0xFF5722),
            option("Metropolis", 0xEEA15E, 0xE91E63),
            option("City Light", 0x35C9E9, 0xC21FEB)
        ]
    }

    private static func option(_ title: String, _ start: UInt32, _ end: UInt32) -> NativeTripBackgroundOption {
        NativeTripBackgroundOption(title: title, image: gradientImage(start: color(start), end: color(end)))
    }

    private static func color(_ hex: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }

    private static func gradientImage(start: UIColor, end: UIColor) -> UIImage {
        let size = CGSize(width: 420, height: 620)
        return UIGraphicsImageRenderer(size: size).image { context in
            let colors = [start.cgColor, end.cgColor] as CFArray
            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: colors,
                locations: [0, 1]
            )!
            context.cgContext.drawLinearGradient(
                gradient,
                start: .zero,
                end: CGPoint(x: size.width, y: size.height),
                options: []
            )
        }
    }
}
