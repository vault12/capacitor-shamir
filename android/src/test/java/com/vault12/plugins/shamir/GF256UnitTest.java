package com.vault12.plugins.shamir;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;


import org.junit.Test;

public class GF256UnitTest {

    @Test
    public void addsub() {
        assertEquals("GF256 add", GF256.add((byte)100, (byte)30), (byte)122);
        assertEquals("GF256 sub", GF256.sub((byte)100, (byte)30), (byte)122);
    }

    @Test
    public void mul() {
        assertEquals("GF256 mul 1", GF256.mul((byte)90, (byte)21),      (byte)254);
        assertEquals("GF256 mul 2", GF256.mul((byte)133, (byte)5),      (byte)167);
        assertEquals("GF256 mul 3", GF256.mul((byte)0, (byte)21),       (byte)0);
        assertEquals("GF256 mul 4", GF256.mul((byte)0xb6, (byte)0x53),  (byte)0x36);
    }

    @Test
    public void div() {
        assertEquals("GF256 div 1", GF256.div((byte)90, (byte)21),  (byte)189);
        assertEquals("GF256 div 2", GF256.div((byte)6, (byte)55),   (byte)151);
        assertEquals("GF256 div 3", GF256.div((byte)22, (byte)192), (byte)138);
        assertEquals("GF256 div 4", GF256.div((byte)0, (byte)192),  (byte)0);
    }

    @Test
    public void commInverse() {
        for (int x = 0; x < 256; x++) {
            for (int y = 0; y < 256; y++) {
                // Commutative
                assertEquals("mul commutative", GF256.mul((byte)x,(byte)y), GF256.mul((byte)y,(byte)x));
                assertEquals("add commutative", GF256.add((byte)x,(byte)y), GF256.add((byte)y,(byte)x));

                // Inverses
                assertEquals("sub cancels add", GF256.sub(GF256.add((byte)x,(byte)y),(byte)y), (byte)x);
                if (y != 0) {
                    assertEquals("mul inverses div", GF256.mul(GF256.div((byte)x,(byte)y),(byte)y), (byte)x);
                    assertEquals("div inverses mul", GF256.div(GF256.mul((byte)x,(byte)y),(byte)y), (byte)x);
                }
            }
        }
    }

    @Test
    public void degree() { // Degree is highest power of poly
        assertEquals(GF256.degree(new byte[]{1, 2}),    (byte)1);
        assertEquals(GF256.degree(new byte[]{1, 2, 0}), (byte)1);
        assertEquals(GF256.degree(new byte[]{1, 2, 3}), (byte)2);
        assertEquals(GF256.degree(new byte[]{0,0,0,0}), (byte)0);
        assertEquals(GF256.degree(new byte[]{0,0,0,1}), (byte)3);
    }

    @Test
    public void evalGenerate() {
        assertEquals(GF256.eval(new byte[]{1, 0, 2, 3}, (byte)2), (byte)17);

        byte[] p = GF256.generate((short)5, (byte)20);
        assertEquals( p[0], (byte)20);
        assertEquals( p.length, (byte)6);
        assertNotEquals( p[p.length-1], (byte)0);
    }

    @Test
    public void inter() {
        assertEquals(GF256.interpolate( new byte[][]{ {1,1},   {2,2}, {3,3}  } ),  (byte)0);
        assertEquals(GF256.interpolate( new byte[][]{ {1,80}, {2,90}, {3,20} } ),  (byte)30);
        assertEquals(GF256.interpolate( new byte[][]{ {1,43}, {2,22}, {3,86} } ),  (byte)107);
    }

}
