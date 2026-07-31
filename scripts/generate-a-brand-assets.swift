import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let projectRoot = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath)
let generatedRoot = URL(fileURLWithPath: CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "/private/tmp/a-brand-generated")
let fileManager = FileManager.default
try? fileManager.createDirectory(at: generatedRoot, withIntermediateDirectories: true)

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat = 1) -> CGColor {
  CGColor(red: red, green: green, blue: blue, alpha: alpha)
}

func makeContext(width: Int, height: Int) -> CGContext {
  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
  return CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  )!
}

func drawGradient(_ context: CGContext, rect: CGRect, from: CGColor, to: CGColor, start: CGPoint, end: CGPoint) {
  let space = CGColorSpace(name: CGColorSpace.sRGB)!
  let gradient = CGGradient(colorsSpace: space, colors: [from, to] as CFArray, locations: [0, 1])!
  context.drawLinearGradient(gradient, start: start, end: end, options: [])
}

func drawMark(_ context: CGContext, rect: CGRect, includeBackground: Bool = true) {
  context.saveGState()
  context.translateBy(x: rect.minX, y: rect.minY)
  context.scaleBy(x: rect.width / 512, y: rect.height / 512)

  if includeBackground {
    let background = CGPath(roundedRect: CGRect(x: 2, y: 2, width: 508, height: 508), cornerWidth: 116, cornerHeight: 116, transform: nil)
    context.saveGState()
    context.addPath(background)
    context.clip()
    drawGradient(
      context,
      rect: CGRect(x: 0, y: 0, width: 512, height: 512),
      from: color(0.02, 0.025, 0.03),
      to: color(0.09, 0.10, 0.115),
      start: CGPoint(x: 0, y: 0),
      end: CGPoint(x: 512, y: 512)
    )
    context.restoreGState()
    context.addPath(background)
    context.setStrokeColor(color(0.96, 0.97, 1))
    context.setLineWidth(4)
    context.strokePath()
  }

  let mark = CGMutablePath()
  mark.move(to: CGPoint(x: 112, y: 398))
  mark.addLine(to: CGPoint(x: 214, y: 114))
  mark.addLine(to: CGPoint(x: 298, y: 114))
  mark.addLine(to: CGPoint(x: 400, y: 398))
  mark.addLine(to: CGPoint(x: 330, y: 398))
  mark.addLine(to: CGPoint(x: 310, y: 335))
  mark.addLine(to: CGPoint(x: 202, y: 335))
  mark.addLine(to: CGPoint(x: 182, y: 398))
  mark.closeSubpath()
  context.saveGState()
  context.addPath(mark)
  context.clip()
  drawGradient(
    context,
    rect: CGRect(x: 100, y: 100, width: 310, height: 310),
    from: color(1, 1, 1),
    to: color(0.83, 0.88, 1),
    start: CGPoint(x: 112, y: 114),
    end: CGPoint(x: 400, y: 398)
  )
  context.restoreGState()

  let cutout = CGMutablePath()
  cutout.move(to: CGPoint(x: 221, y: 280))
  cutout.addLine(to: CGPoint(x: 291, y: 280))
  cutout.addLine(to: CGPoint(x: 256, y: 183))
  cutout.closeSubpath()
  context.addPath(cutout)
  context.setBlendMode(.clear)
  context.fillPath()
  context.restoreGState()
}

func drawText(_ context: CGContext, _ text: String, x: CGFloat, top: CGFloat, size: CGFloat, height: CGFloat, color: CGColor, weight: String = "PingFangSC-Regular") {
  let font = CTFontCreateWithName(weight as CFString, size, nil)
  let attributed = NSAttributedString(string: text, attributes: [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
  ])
  let line = CTLineCreateWithAttributedString(attributed)
  let bounds = CTLineGetBoundsWithOptions(line, [])
  context.saveGState()
  context.textPosition = CGPoint(x: x, y: height - top - size - bounds.minY)
  CTLineDraw(line, context)
  context.restoreGState()
}

func renderIcon(size: Int) -> CGImage {
  let context = makeContext(width: size, height: size)
  context.saveGState()
  context.translateBy(x: 0, y: CGFloat(size))
  context.scaleBy(x: 1, y: -1)
  drawMark(context, rect: CGRect(x: 0, y: 0, width: size, height: size))
  context.restoreGState()
  return context.makeImage()!
}

func renderHeader() -> CGImage {
  let width = 150
  let height = 57
  let context = makeContext(width: width, height: height)
  context.setFillColor(color(1, 1, 1))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.setFillColor(color(0.20, 0.34, 0.97))
  context.fill(CGRect(x: 12, y: 12, width: 2, height: 33))
  drawText(context, "A", x: 26, top: 7, size: 16, height: CGFloat(height), color: color(0.04, 0.05, 0.08), weight: "PingFangSC-Semibold")
  drawText(context, "A 安装向导", x: 26, top: 29, size: 7, height: CGFloat(height), color: color(0.20, 0.25, 0.38))
  context.setFillColor(color(0.20, 0.34, 0.97))
  context.fillEllipse(in: CGRect(x: 124, y: 22, width: 8, height: 8))
  return context.makeImage()!
}

func renderSidebar() -> CGImage {
  let width = 164
  let height = 314
  let context = makeContext(width: width, height: height)
  context.setFillColor(color(1, 1, 1))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.setFillColor(color(0.20, 0.34, 0.97))
  context.fill(CGRect(x: 21, y: 36, width: 2, height: 44))
  drawText(context, "A", x: 36, top: 33, size: 12, height: CGFloat(height), color: color(0.20, 0.34, 0.97), weight: "PingFangSC-Semibold")
  drawText(context, "音乐播放器", x: 36, top: 65, size: 22, height: CGFloat(height), color: color(0.04, 0.05, 0.08), weight: "PingFangSC-Semibold")
  drawText(context, "歌词与视觉", x: 36, top: 99, size: 11, height: CGFloat(height), color: color(0.20, 0.25, 0.38))
  context.setStrokeColor(color(0.84, 0.85, 0.89))
  context.setLineWidth(1)
  context.move(to: CGPoint(x: 24, y: 145))
  context.addLine(to: CGPoint(x: 140, y: 145))
  context.strokePath()
  context.setFillColor(color(0.20, 0.34, 0.97))
  context.fill(CGRect(x: 33, y: 160, width: 44, height: 3))
  context.setFillColor(color(0.05, 0.06, 0.08))
  context.fill(CGRect(x: 33, y: 176, width: 76, height: 3))
  drawText(context, "安装", x: 33, top: 222, size: 9, height: CGFloat(height), color: color(0.04, 0.05, 0.08), weight: "PingFangSC-Semibold")
  drawText(context, "D:\\A", x: 33, top: 245, size: 10, height: CGFloat(height), color: color(0.20, 0.25, 0.38))
  return context.makeImage()!
}

func writeImage(_ image: CGImage, to url: URL, type: UTType) throws {
  guard let destination = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil) else {
    throw NSError(domain: "ABrandAssets", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法创建图像输出：\(url.path)"])
  }
  CGImageDestinationAddImage(destination, image, nil)
  if !CGImageDestinationFinalize(destination) {
    throw NSError(domain: "ABrandAssets", code: 2, userInfo: [NSLocalizedDescriptionKey: "无法写入图像：\(url.path)"])
  }
}

let buildRoot = projectRoot.appendingPathComponent("build")
try writeImage(renderIcon(size: 512), to: buildRoot.appendingPathComponent("icon.png"), type: .png)
try writeImage(renderHeader(), to: buildRoot.appendingPathComponent("installerHeader.bmp"), type: .bmp)
try writeImage(renderSidebar(), to: buildRoot.appendingPathComponent("installerSidebar.bmp"), type: .bmp)
for size in [16, 24, 32, 48, 64, 128, 256] {
  try writeImage(renderIcon(size: size), to: generatedRoot.appendingPathComponent("icon-\(size).png"), type: .png)
}

func appendUInt16(_ value: UInt16, to data: inout Data) {
  data.append(UInt8(value & 0xff))
  data.append(UInt8((value >> 8) & 0xff))
}

func appendUInt32(_ value: UInt32, to data: inout Data) {
  data.append(UInt8(value & 0xff))
  data.append(UInt8((value >> 8) & 0xff))
  data.append(UInt8((value >> 16) & 0xff))
  data.append(UInt8((value >> 24) & 0xff))
}

let iconSizes = [16, 24, 32, 48, 64, 128, 256]
let iconData = try iconSizes.map { size -> (Int, Data) in
  (size, try Data(contentsOf: generatedRoot.appendingPathComponent("icon-\(size).png")))
}
var ico = Data()
appendUInt16(0, to: &ico)
appendUInt16(1, to: &ico)
appendUInt16(UInt16(iconData.count), to: &ico)
var nextOffset = UInt32(6 + iconData.count * 16)
for (size, data) in iconData {
  ico.append(UInt8(size == 256 ? 0 : size))
  ico.append(UInt8(size == 256 ? 0 : size))
  ico.append(0)
  ico.append(0)
  appendUInt16(1, to: &ico)
  appendUInt16(32, to: &ico)
  appendUInt32(UInt32(data.count), to: &ico)
  appendUInt32(nextOffset, to: &ico)
  nextOffset += UInt32(data.count)
}
for (_, data) in iconData {
  ico.append(data)
}
try ico.write(to: buildRoot.appendingPathComponent("icon.ico"), options: .atomic)
