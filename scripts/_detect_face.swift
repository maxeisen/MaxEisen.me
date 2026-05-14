// Detect the largest face in an image and print its pixel bounding box.
// Usage:  swift _detect_face.swift <image_path>
// Output: "x y width height"  (in pixel coords, top-left origin)
// Exit codes: 0 = ok, 1 = image load failed, 2 = no face found

import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count >= 2 else {
    FileHandle.standardError.write("usage: swift _detect_face.swift <image_path>\n".data(using: .utf8)!)
    exit(64)
}

let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: (path as NSString).expandingTildeInPath)

guard
    let data = try? Data(contentsOf: url),
    let image = NSImage(data: data),
    let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
    exit(1)
}

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
let request = VNDetectFaceRectanglesRequest()

do {
    try handler.perform([request])
} catch {
    exit(1)
}

guard let observations = request.results, !observations.isEmpty else {
    exit(2)
}

let w = CGFloat(cgImage.width)
let h = CGFloat(cgImage.height)

let largest = observations.max { a, b in
    a.boundingBox.width * a.boundingBox.height < b.boundingBox.width * b.boundingBox.height
}!

// Vision normalizes coords with origin at bottom-left; convert to top-left pixels.
let bb = largest.boundingBox
let x = bb.origin.x * w
let y = (1.0 - bb.origin.y - bb.height) * h
let bw = bb.width * w
let bh = bb.height * h
print("\(Int(x.rounded())) \(Int(y.rounded())) \(Int(bw.rounded())) \(Int(bh.rounded()))")
