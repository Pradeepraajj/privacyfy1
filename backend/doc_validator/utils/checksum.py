# doc_validator/utils/checksum.py

# Verhoeff Algorithm Tables (Standard UIDAI implementation)
d_table = [
    [0,1,2,3,4,5,6,7,8,9], [1,2,3,4,0,6,7,8,9,5], [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7], [4,0,1,2,3,9,5,6,7,8], [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2], [7,6,5,9,8,2,1,0,4,3], [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0]
]
p_table = [
    [0,1,2,3,4,5,6,7,8,9], [1,5,7,6,2,8,3,0,9,4], [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7], [9,4,5,3,1,2,6,8,7,0], [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5], [7,0,4,6,9,1,3,2,5,8]
]
inv_table = [0,4,3,2,1,5,6,7,8,9]

def validate_verhoeff(num_str):
    """
    Validates a 12-digit number using Verhoeff checksum.
    Returns: Boolean
    """
    if not num_str.isdigit() or len(num_str) != 12:
        return False
    
    c = 0
    ll = list(map(int, reversed(num_str)))
    for i, item in enumerate(ll):
        c = d_table[c][p_table[i % 8][item]]
    return c == 0