"""
Demo User Data
Pre-populated mock data for the demo account.
This data matches exactly what the frontend currently displays.
"""
from werkzeug.security import generate_password_hash

# Demo user credentials
DEMO_USER_ID = 'demo-user-1'
DEMO_EMAIL = 'demo@geosegai.ai'
DEMO_PASSWORD = 'demo123'

# Demo user profile
DEMO_USER = {
    'id': DEMO_USER_ID,
    'email': DEMO_EMAIL,
    'password_hash': generate_password_hash(DEMO_PASSWORD),
    'name': 'Dr. Alex Rivera',
    'role': 'Researcher',
    'organization': 'Earth Observation Institute',
    'avatar': None,
    'created_at': '2023-01-15T10:00:00'
}

# Demo user statistics (matching DashboardPage.jsx)
DEMO_STATS = {
    'user_id': DEMO_USER_ID,
    'total_images': 1240,
    'total_segmentations': 856,
    'storage_used_gb': 45,
    'storage_limit_gb': 100,
    'active_projects': 12
}

# Demo user projects (matching ProjectsPage.jsx)
DEMO_PROJECTS = [
    {
        'id': '1',
        'user_id': DEMO_USER_ID,
        'name': 'Amazon Sector A',
        'date': 'Oct 24, 2023',
        'model': 'ResNet-50',
        'tag': 'Deforestation',
        'status': 'processing',
        'image': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvt-9pcbUduH40d6zlp0gNdsUN5flU2GzGxCPc2_HkKlvdhE8sKSP-RVPdmA4Pofp6Ed_J4PdGORGH4Gmgy8KF19E78e5L--nQ3TH8d0qKPlPNzpglg4TJxNQxKlv5pDXcoeJW3PEjeXN0vDsZsC94ryWVSyA1Iavpiil1Vpj7LmvNRMkFXHNh5fwkpRLtchv-M3HfZK6l94fKiARUEigb_0n3P0duJY4Ts0Clwj41ElH3EyM5rLo-p28ntLfnGns0B8gu3IkJp0vk'
    },
    {
        'id': '2',
        'user_id': DEMO_USER_ID,
        'name': 'Urban Sprawl Analysis',
        'date': 'Oct 22, 2023',
        'model': 'U-Net V2',
        'tag': 'Urban',
        'status': 'completed',
        'image': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCCwmCUxlgyA_OaGe9nHoe7z7c9NGiTcVaY0EBsCfKzJqj7f2-fOqgV3kOxmEexJdWH03gQK0KUUey2cHyxTUmQE33n8OG462dHPX6zuBpWCFNXk9ktJz0bmNaZXF0ifumLHK10KTfCBJ5zAMooi3qdcJNgD6oHZjSlt54qaJFYnqtWLjncFtynEcBB3NR8QraegfWUB_aHC-kYerPcrdMR1_V-b18QUTaepv04sQKMfGT7LUXRYyhalBMLQKDUghSbgyz3KJTx1TMC'
    },
    {
        'id': '3',
        'user_id': DEMO_USER_ID,
        'name': 'Sahara Dune Migration',
        'date': 'Oct 18, 2023',
        'model': 'ResNet-101',
        'tag': 'Geological',
        'status': 'completed',
        'image': 'https://lh3.googleusercontent.com/aida-public/AB6AXuA1to3XiqlBJJPEXOjjKKaydoqFy9t3vrWQ-tVwvDEGAiDI3_dJi2nfxlCaJ46s9k8wqHD84MJ4wYK2mlgWqL0bZzkerDJjckXLhJIRaBHB3D4Z_gOt-sjvUwykCUHli1vY_QgIhDN6y28buID1AeXbVlIjk2HtGucGa3qkz6ya8jD4N4Q_iCYz5aEbJNRNpdU3zy5fBbTQCG4JewGsqghwdKRkQsIZf4KZjbPhnL3B5zoPJuMPy-q1O4QNu1v8u1AnNNEK9Oe6gH59'
    },
    {
        'id': '4',
        'user_id': DEMO_USER_ID,
        'name': 'Arctic Shelf Monitor',
        'date': 'Oct 15, 2023',
        'model': 'Custom CNN',
        'tag': 'Cryosphere',
        'status': 'failed',
        'image': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzRE9N0TLUDQr9ro7hCtIUwmKkgdRVoyj6_XwGRC-w1OdZ1TF138ejRpzqPvlbOZ47H1YCy0yo8RoPvVPH-0TQ-qWRb-jjIANMTYCuHg36GfAuG53IrJw4J4l4Olqt8oQxkZny3dIyyMlEQWk7WmwGSU7gZOotVP3pG6oSAb7rwnRbwuBs5npUqTPraJleGXr60if1Ay_XtfsdbFpuUR4M73Mk-s9vA9i2Ks6IDlCPb2CJdJgwYL9OFBkxtrVZyH0CaD_PYIWECML1'
    },
    {
        'id': '5',
        'user_id': DEMO_USER_ID,
        'name': 'Crop Yield Estimator',
        'date': 'Oct 10, 2023',
        'model': 'Mask R-CNN',
        'tag': 'Agriculture',
        'status': 'completed',
        'image': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCyPY6J0t6XeoEQ2ITFFA5AHxrmytZ4XnLPJrmwrGelDedBXtvyLl9Gih07Cr5PViElWUbXfKAtEt_cevesmVJct3Xih3Rfadi5xLscb18ZM7DNUp4sXR1kwQBnYgDKpy5KhUaCo_H9cnljHHbm__03ySyDX1OpNHHSXPvhsrsAB_2ZjypeEIZToSk_PcTJYTLwDcxnpQ9pS4A_PFXOt-eROp3Q2jS6qD5NOzIiOzPwp0hMSSxTusIGuuhP54JgGsgTnw-DiYEaHryF'
    }
]

# Demo user recent activity (matching DashboardPage.jsx)
DEMO_ACTIVITIES = [
    {
        'id': 'act-1',
        'user_id': DEMO_USER_ID,
        'name': 'Deforestation Analysis',
        'source': 'Sentinel-2',
        'date': 'Oct 24, 2023',
        'status': 'completed',
        'image': 'https://lh3.googleusercontent.com/aida-public/AB6AXuB6VgJKUenw88qZYjHXhkD4X6wb_Kgy-ifqDhb7L4iVLucfNnds-l6WJnnvqP7pLIQi82auCe9pMAzFO5sjpczzN3a07Vqqfh4JoMphQu3V4rfDG5UuxQib3jUooz9t_OkFhQ_W_ajXYNkuTdVD00wxHYYelwGX9ssrVAL-OYeZdg8jxf2Z7NarY-2hWYB4JHnaJr0KeHui4BP6pOpviF8r7eLZsFX7Yn8NMlz7MnYc9KsBvAMgaZpi_gHD-ZmQkpjhJwxX1GEoagvi'
    },
    {
        'id': 'act-2',
        'user_id': DEMO_USER_ID,
        'name': "Urban Expansion '23",
        'source': 'Landsat 8',
        'date': 'Oct 23, 2023',
        'status': 'processing',
        'image': 'https://lh3.googleusercontent.com/aida-public/AB6AXuC6x0FysyGPHg4Vn0bcdQz6baIY1VAZIZXCLgZTNBsUvF0MH6MWe95Dp1Bh7_Zq_83QbXxRvsqyWH1F7NrxgOjF7QW3bYXYRvTJFs0M_wSnQ8IMOs0EP5jGMuKxc8OKusco_oXnq0U0BHGIWqyMxp_8H6NSgmhTHsGDOWy47zzkimLf_CNpJw9hWo1TngkCFLAJR3VGUzmaKj2SaT8bfNpd86qLvd_IjHw7etVjYIdMDnpkqE28m-ZSt3IJKwpOk5EnzOzwwOSl4Uk2'
    },
    {
        'id': 'act-3',
        'user_id': DEMO_USER_ID,
        'name': 'Delta Flood Mapping',
        'source': 'Sentinel-1 SAR',
        'date': 'Oct 22, 2023',
        'status': 'failed',
        'image': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnXr6sFcVaEurVhCp3RfoTUuHq7Zzst6Y4894K7YiGMbG3_X3b96HEx5qG6cl5aFqL2y5zCvkPsvma9bH_t99nxnpU6IFb3ayr-3p8P1jzIl-oVXGOGOEO3znFOO2vUhzRVCoyEOTpC16ksvAHoeCZegLkbI7s3uFQ-0gPHLQB81Etpx6AfnRxQBTGlVEgLjqyYaDC0iNppysrOIH6Fk5Dx8LlceN5ctOEW01tvrUB_vWiRRCvrrLLdzJ9OqNYf4lODFh7NaEm2VE8'
    },
    {
        'id': 'act-4',
        'user_id': DEMO_USER_ID,
        'name': 'Crop Health Index',
        'source': 'PlanetScope',
        'date': 'Oct 20, 2023',
        'status': 'completed',
        'image': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWW3QIgp5VRtJBwaH15fIMxLKrlCgov2qS0jt8Y6dIKovjB7j5cUnBE5-3I97il_V73kbuyuFfNPCiyMJDNtqBu-wC9-s0GxYpbaA7CTJLdTkmr5P_hNX3qJgcX_JQ7Jppetlp_6rktVgus18TLrBgqCf3fi3zOVEgIkC3e4H6DNxUQbKdrh4_KqbqHtO1l0KX7VWM7-WRJ_xznuSJjztZdau5GwYnKDA_0PNVdVn5YNEWSjBZWpZYryzM3ea5UWhwXuF8UplS0IYi'
    }
]


def get_demo_user():
    """Get the demo user data."""
    return DEMO_USER.copy()


def get_demo_stats():
    """Get the demo user statistics."""
    return DEMO_STATS.copy()


def get_demo_projects():
    """Get the demo user projects."""
    return [p.copy() for p in DEMO_PROJECTS]


def get_demo_activities():
    """Get the demo user activities."""
    return [a.copy() for a in DEMO_ACTIVITIES]
