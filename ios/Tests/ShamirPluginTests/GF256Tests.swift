import XCTest

@testable import ShamirPlugin

class GF256Tests: XCTestCase {

    func test_addsub() {
        XCTAssertEqual( GF256.add(100,30), 122, "GF256 add")
        XCTAssertEqual( GF256.sub(100,30), 122, "GF256 sub")
    }

    func test_mul() {
        XCTAssertEqual( GF256.mul(90, 21),      254,  "GF256 mul 1")
        XCTAssertEqual( GF256.mul(133, 5),      167,  "GF256 mul 2")
        XCTAssertEqual( GF256.mul(0, 21),       0,    "GF256 mul 3")
        XCTAssertEqual( GF256.mul(0xb6, 0x53),  0x36, "GF256 mul 4")
    }

    func test_div() {
        XCTAssertEqual( GF256.div(90, 21),  189,  "GF256 div 1")
        XCTAssertEqual( GF256.div(6, 55),   151,  "GF256 div 2")
        XCTAssertEqual( GF256.div(22, 192), 138,  "GF256 div 3")
        XCTAssertEqual( GF256.div(0, 192),  0,    "GF256 div 4")
    }

    func test_comm_inverse() {
        for x:UInt8 in 0...255 {
            for y:UInt8 in 0...255 {
                // Commutative
                XCTAssertEqual(GF256.mul(x,y), GF256.mul(y,x), "mul commutative")
                XCTAssertEqual(GF256.add(x,y), GF256.add(y,x), "add commutative")

                // Inverses
                XCTAssertEqual(GF256.sub(GF256.add(x,y),y), x, "sub cancels add")
                if y != 0 {
                    XCTAssertEqual(GF256.mul(GF256.div(x,y),y), x, "mul inverses div")
                    XCTAssertEqual(GF256.div(GF256.mul(x,y),y), x, "div inverses mul")
                }
            }
        }
    }

    func test_degree() {  // Degree is higest power of poly
        XCTAssertEqual(GF256.degree([1, 2]),    1)
        XCTAssertEqual(GF256.degree([1, 2, 0]), 1)
        XCTAssertEqual(GF256.degree([1, 2, 3]), 2)
        XCTAssertEqual(GF256.degree([0,0,0,0]), 0)
        XCTAssertEqual(GF256.degree([0,0,0,1]), 3)
    }

    func test_eval_generate() throws {
        XCTAssertEqual(GF256.eval([1, 0, 2, 3], 2), 17)

        let p = try GF256.generate(5, x:20)
        XCTAssertEqual( p[0], 20)
        XCTAssertEqual( p.count, 6)
        XCTAssertNotEqual( p[p.count-1], 0)
    }

    func test_inter() {
        XCTAssertEqual(GF256.interpolate( [ [1,1],   [2,2], [3,3]  ] ),  0)
        XCTAssertEqual(GF256.interpolate( [ [1,80], [2,90], [3,20] ] ),  30)
        XCTAssertEqual(GF256.interpolate( [ [1,43], [2,22], [3,86] ] ),  107)

    }
}
