SELECT update_recent_cl_array();

-- Badge id 17 is reserved and retired. Move it onto bitfield 199 (BSC Early Supporter).
UPDATE users
SET
    badges = array_remove(badges, 17),
    bitfield = CASE
        WHEN bitfield IS NULL THEN ARRAY[199]::integer[]
        WHEN 199 = ANY (bitfield) THEN bitfield
        ELSE array_append(bitfield, 199)
    END
WHERE 17 = ANY (badges);

