<file name=db_utils.py path=/Users/armen/Desktop/Haylingua/Haylinguav2/backend>
def seed_alphabet_lessons():
    print("[db_utils] Seeding alphabet lessons...")
    with engine.connect() as conn:
        lesson1_id = conn.execute(
            text(
                """
                    INSERT INTO lessons (slug, title, description, level, xp, xp_reward)
                    VALUES (:slug, :title, :description, :level, :xp, :xp_reward)
                    RETURNING id
                """
            ),
            {
                "slug": "alphabet-1",
                "title": "Alphabet 1: First Letters",
                "description": "Start learning the Armenian alphabet with your first letters.",
                "level": 1,
                "xp": 40,
                "xp_reward": 40,
            },
        ).scalar_one()

        lesson2_id = conn.execute(
            text(
                """
                    INSERT INTO lessons (slug, title, description, level, xp, xp_reward)
                    VALUES (:slug, :title, :description, :level, :xp, :xp_reward)
                    RETURNING id
                """
            ),
            {
                "slug": "alphabet-2",
                "title": "Alphabet 2: Next Letters",
                "description": "Continue learning the Armenian alphabet with the next letters.",
                "level": 2,
                "xp": 50,
                "xp_reward": 50,
            },
        ).scalar_one()

        # ... other inserts follow the same pattern ...
</file>
